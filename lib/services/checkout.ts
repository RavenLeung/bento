import { isDemoMode, isSquareConfigured, env } from "@/lib/config";
import { getCatalogSnapshot } from "@/lib/catalog";
import { buildQuote } from "@/lib/domain/quote";
import { generateSlotTimes } from "@/lib/domain/slots";
import { enqueueOutbox } from "@/lib/outbox";
import {
  attachSquareOrder,
  createOrderWithSlot,
  findOrderByIdempotencyKey,
  markOrderFailed,
  markOrderPaid
} from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/settings";
import { SquareApiError } from "@/lib/square/client";
import { cancelSquareOrder, createSquareOrder, createSquarePayment } from "@/lib/square/orders";
import { AppError, type OrderRecord, type Quote } from "@/lib/types";
import { signQuote, verifyQuoteToken } from "@/lib/signing";

export interface CheckoutInput {
  quoteToken: string;
  paymentToken: string;
  customerName: string;
  customerEmail: string;
  pickupAt: string;
  allergenAcknowledged: boolean;
  idempotencyKey: string;
  paymentAttemptKey?: string;
}

export async function createQuote(input: {
  boxItemId: string;
  selections: Array<{ itemId: string; quantity: number }>;
}): Promise<Quote> {
  const catalog = await getCatalogSnapshot();
  const draft = buildQuote({
    boxItemId: input.boxItemId,
    selections: input.selections,
    catalog: catalog.items,
    currency: env.STORE_CURRENCY
  });
  const signed = signQuote(draft);
  return { ...draft, ...signed };
}

export async function checkout(input: CheckoutInput): Promise<OrderRecord> {
  const settings = await getStoreSettings();
  if (!settings.acceptingOrders) {
    throw new AppError("ORDERS_PAUSED", "The kitchen has paused new orders. Please try again shortly.", 503);
  }

  const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (existing && ["PAID", "READY", "PICKED_UP"].includes(existing.status)) {
    await enqueueOutbox("email.confirmation", { orderId: existing.id });
    return existing;
  }
  if (existing && ["FAILED", "CANCELED", "REFUNDED"].includes(existing.status)) {
    throw new AppError(
      "PAYMENT_RETRY",
      "That payment attempt has ended. Please try payment again.",
      409
    );
  }

  const signedQuote = verifyQuoteToken(input.quoteToken);
  const catalog = await getCatalogSnapshot();
  const currentQuote = buildQuote({
    boxItemId: signedQuote.boxItemId,
    selections: signedQuote.selections,
    catalog: catalog.items,
    currency: env.STORE_CURRENCY
  });

  if (currentQuote.totalCents !== signedQuote.totalCents) {
    throw new AppError(
      "PRICE_CHANGED",
      "An ingredient price changed. Please review your bento and try again.",
      409
    );
  }

  const validSlots = generateSlotTimes(settings);
  if (!validSlots.some((slot) => slot.at === input.pickupAt)) {
    throw new AppError("SLOT_UNAVAILABLE", "That pickup time is no longer available.", 409);
  }

  if (existing?.status === "PENDING_PAYMENT") {
    const currentLines = new Map(currentQuote.lines.map((line) => [line.itemId, line.quantity]));
    const sameBox = existing.boxItemId === currentQuote.boxItemId;
    const sameLines =
      existing.lines.length === currentQuote.lines.length &&
      existing.lines.every((line) => currentLines.get(line.catalogItemId) === line.quantity);
    const samePickupAt = existing.pickupAt === new Date(input.pickupAt).toISOString();
    const sameTotal = existing.totalCents === currentQuote.totalCents;
    if (!sameBox || !sameLines || !samePickupAt || !sameTotal) {
      throw new AppError(
        "PAYMENT_RETRY",
        "Your bento or pickup time changed. Please start a fresh payment attempt.",
        409
      );
    }
  }

  const order = await createOrderWithSlot({
    pickupAt: new Date(input.pickupAt),
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    boxItemId: currentQuote.boxItemId,
    boxName: currentQuote.boxName,
    boxCapacity: currentQuote.boxCapacity,
    subtotalCents: currentQuote.totalCents,
    totalCents: currentQuote.totalCents,
    currency: currentQuote.currency,
    idempotencyKey: input.idempotencyKey,
    allergenAcknowledged: input.allergenAcknowledged,
    lines: currentQuote.lines,
    slotCapacity: settings.slotCapacity
  });

  if (!order) {
    throw new AppError("SLOT_UNAVAILABLE", "That pickup time just filled up. Choose another slot.", 409);
  }

  if (isDemoMode) {
    const paid = await markOrderPaid(order.id, "demo-payment");
    await enqueueOutbox("email.confirmation", { orderId: order.id });
    return paid ?? order;
  }

  if (!isSquareConfigured) {
    await markOrderFailed(order.id, "Square is not configured.");
    throw new AppError("NOT_CONFIGURED", "Online payment is not configured yet.", 503);
  }

  let squareOrderId: string | null = null;
  try {
    const squareOrder = await createSquareOrder(order);
    squareOrderId = squareOrder.id;
    const squareTotal = Number(squareOrder.total_money?.amount ?? -1);
    if (squareTotal !== currentQuote.totalCents) {
      await cancelSquareOrder(squareOrder.id);
      await markOrderFailed(order.id, `Square total mismatch: ${squareTotal} vs ${currentQuote.totalCents}`);
      throw new AppError(
        "PRICE_CHANGED",
        "The Square order total changed. Please review your bento and try again.",
        409
      );
    }

    await attachSquareOrder(order.id, squareOrder.id, squareTotal);
    const payment = await createSquarePayment(
      order,
      squareOrder.id,
      squareTotal,
      input.paymentToken,
      input.paymentAttemptKey
    );
    const paid = await markOrderPaid(order.id, payment.id);
    await enqueueOutbox("email.confirmation", { orderId: order.id });
    return paid ?? order;
  } catch (error) {
    const definitive = isDefinitiveFailure(error);
    if (squareOrderId && definitive) {
      await cancelSquareOrder(squareOrderId);
    }
    if (definitive) {
      await markOrderFailed(
        order.id,
        error instanceof Error ? error.message.slice(0, 500) : "Checkout failed."
      );
    }
    throw checkoutError(error, definitive);
  }
}

function isDefinitiveFailure(error: unknown): boolean {
  if (error instanceof AppError) {
    return ["PAYMENT_DECLINED", "PRICE_CHANGED", "NOT_CONFIGURED", "BAD_REQUEST"].includes(
      error.code
    );
  }
  if (error instanceof SquareApiError) {
    return error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
  }
  return false;
}

function checkoutError(error: unknown, definitive: boolean): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof SquareApiError) {
    if (error.status === 402) {
      return new AppError(
        "PAYMENT_DECLINED",
        "Your card was declined. Try another card or ask the team for help.",
        402,
        error.body
      );
    }
    return new AppError(
      definitive ? "INTERNAL_ERROR" : "PAYMENT_UNCERTAIN",
      definitive
        ? "Square could not process this order. Please try again or ask the team for help."
        : "We could not confirm the payment result. Please wait a moment and try again before using another card.",
      definitive ? 502 : 503,
      error.body
    );
  }

  return new AppError(
    "PAYMENT_UNCERTAIN",
    "We could not confirm the payment result. Please wait a moment and try again before using another card.",
    503
  );
}
