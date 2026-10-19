import { randomUUID } from "node:crypto";
import { squareConfig } from "@/lib/config";
import { AppError, type OrderRecord } from "@/lib/types";
import { squareFetch, SquareApiError } from "@/lib/square/client";
import type { SquareOrder, SquarePayment } from "@/lib/square/types";

interface OrderResponse {
  order?: SquareOrder;
  errors?: Array<{ code?: string; detail?: string }>;
}

interface PaymentResponse {
  payment?: SquarePayment;
  errors?: Array<{ code?: string; detail?: string }>;
}

export async function createSquareOrder(order: OrderRecord): Promise<SquareOrder> {
  if (!squareConfig.locationId) {
    throw new AppError("NOT_CONFIGURED", "Square location is not configured.", 503);
  }

  const body = {
    idempotency_key: `order:${order.idempotencyKey}`,
    order: {
      location_id: squareConfig.locationId,
      reference_id: order.orderCode,
      source: { name: "Bento Builder" },
      ticket_name: `${order.orderCode} · ${order.boxName}`.slice(0, 60),
      line_items: order.lines.map((line) => ({
        uid: randomUUID(),
        catalog_object_id: line.catalogItemId,
        quantity: String(line.quantity)
      })),
      fulfillments: [
        {
          uid: randomUUID(),
          type: "PICKUP",
          state: "PROPOSED",
          pickup_details: {
            recipient: {
              display_name: order.customerName,
              email_address: order.customerEmail
            },
            pickup_at: order.pickupAt,
            note: `Bento Builder ${order.orderCode}`
          },
          metadata: {
            bento_order_code: order.orderCode,
            box_type: order.boxName,
            box_capacity: String(order.boxCapacity)
          }
        }
      ]
    }
  };

  const response = await squareFetch<OrderResponse>("/v2/orders", {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (!response.order?.id) {
    throw new AppError("INTERNAL_ERROR", "Square did not return an order.", 502, response.errors);
  }
  return response.order;
}

export async function createSquarePayment(
  order: OrderRecord,
  squareOrderId: string,
  amountCents: number,
  paymentToken: string,
  paymentAttemptKey?: string
): Promise<SquarePayment> {
  const response = await squareFetch<PaymentResponse>("/v2/payments", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: `payment:${paymentAttemptKey ?? order.idempotencyKey}`,
      source_id: paymentToken,
      amount_money: { amount: amountCents, currency: order.currency },
      order_id: squareOrderId,
      reference_id: order.orderCode,
      buyer_email_address: order.customerEmail,
      note: `Bento Builder ${order.orderCode}`,
      autocomplete: true
    })
  });
  if (!response.payment?.id) {
    throw new AppError("PAYMENT_DECLINED", "Square did not return a payment.", 402, response.errors);
  }
  if (!["COMPLETED", "APPROVED"].includes(response.payment.status ?? "")) {
    throw new AppError(
      "PAYMENT_DECLINED",
      `Payment was not completed (${response.payment.status ?? "unknown"}).`,
      402,
      response.payment
    );
  }
  return response.payment;
}

export async function getSquareOrder(squareOrderId: string): Promise<SquareOrder | null> {
  try {
    const response = await squareFetch<OrderResponse>(`/v2/orders/${squareOrderId}`);
    return response.order ?? null;
  } catch (error) {
    if (error instanceof SquareApiError && error.status === 404) return null;
    throw error;
  }
}

export async function updateSquareFulfillmentState(
  squareOrderId: string,
  targetState: "PREPARED" | "COMPLETED" | "CANCELED",
  orderState?: "OPEN" | "COMPLETED" | "CANCELED"
): Promise<void> {
  const current = await getSquareOrder(squareOrderId);
  if (!current?.fulfillments?.length) {
    throw new AppError("INTERNAL_ERROR", "Square order has no fulfillment to update.", 502);
  }

  const fulfillments = current.fulfillments
    .filter((fulfillment) => fulfillment.type === "PICKUP")
    .map((fulfillment) => ({ uid: fulfillment.uid, state: targetState }));
  if (fulfillments.length === 0) {
    throw new AppError("INTERNAL_ERROR", "Square order has no pickup fulfillment to update.", 502);
  }

  await squareFetch<OrderResponse>(`/v2/orders/${squareOrderId}`, {
    method: "PUT",
    body: JSON.stringify({
      idempotency_key: `fulfillment:${squareOrderId}:${targetState}:${current.version ?? 0}`,
      order: {
        version: current.version,
        state: orderState,
        fulfillments
      }
    })
  });
}

export async function cancelSquareOrder(squareOrderId: string): Promise<void> {
  try {
    await updateSquareFulfillmentState(squareOrderId, "CANCELED", "CANCELED");
  } catch (error) {
    console.error("Unable to cancel Square order", squareOrderId, error);
  }
}
