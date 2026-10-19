import { sqlClient } from "@/lib/db/client";
import { parseJsonColumn } from "@/lib/db/json";
import { enqueueOutbox } from "@/lib/outbox";
import {
  getOrderBySquareOrderId,
  getOrderBySquarePaymentId,
  markOrderCanceled,
  markOrderPaidBySquareId,
  markOrderPickedUp,
  markOrderReady,
  markOrderRefunded
} from "@/lib/repositories/orders";
import { getSquareOrder } from "@/lib/square/orders";
import type { OrderRecord } from "@/lib/types";
import type { SquareOrder, SquareWebhookEvent } from "@/lib/square/types";

const MAX_EVENT_ATTEMPTS = 5;

export async function storeSquareEvent(event: SquareWebhookEvent): Promise<void> {
  if (!sqlClient) return;
  await sqlClient`
    insert into webhook_events (event_id, type, payload, status, attempts, received_at)
    values (${event.event_id}, ${event.type}, ${JSON.stringify(event)}::jsonb, 'pending', 0, now())
    on conflict (event_id) do nothing
  `;
}

export async function processSquareEvent(eventId: string): Promise<void> {
  if (!sqlClient) return;
  const [row] = await sqlClient<Array<Record<string, unknown>>>`
    select event_id, type, payload, status, attempts
    from webhook_events where event_id = ${eventId} limit 1
  `;
  if (!row || row.status === "processed") return;

  try {
    const event = parseJsonColumn<SquareWebhookEvent>(
      row.payload,
      {} as SquareWebhookEvent
    );
    await handleSquareEvent(event);
    await sqlClient`
      update webhook_events
      set status = 'processed', processed_at = now(), last_error = null
      where event_id = ${eventId}
    `;
  } catch (error) {
    const attempts = Number(row.attempts ?? 0) + 1;
    const terminal = attempts >= MAX_EVENT_ATTEMPTS;
    await sqlClient`
      update webhook_events
      set status = ${terminal ? "failed" : "pending"},
          attempts = ${attempts},
          last_error = ${error instanceof Error ? error.message : String(error)}
      where event_id = ${eventId}
    `;
    console.error("Square webhook processing failed", eventId, error);
  }
}

export async function processPendingWebhookEvents(limit = 20): Promise<number> {
  if (!sqlClient) return 0;
  const rows = await sqlClient<Array<{ event_id: string }>>`
    select event_id from webhook_events
    where status = 'pending'
    order by received_at asc
    limit ${limit}
  `;
  for (const row of rows) {
    await processSquareEvent(row.event_id);
  }
  return rows.length;
}

export async function handleSquareEvent(event: SquareWebhookEvent): Promise<void> {
  if (event.type === "catalog.version.updated") {
    await enqueueOutbox("catalog.refresh", {});
    return;
  }

  if (event.type === "order.updated" || event.type === "order.fulfillment.updated") {
    const details = extractOrderDetails(event);
    if (!details.squareOrderId) return;
    const order = await getOrderBySquareOrderId(details.squareOrderId);
    if (!order) {
      console.warn("Square order has no local order", details.squareOrderId);
      return;
    }

    let orderState = details.orderState;
    let fulfillmentState = details.fulfillmentState;
    if (!fulfillmentState && orderState !== "COMPLETED" && orderState !== "CANCELED") {
      const squareOrder = details.order ?? (await getSquareOrder(details.squareOrderId));
      orderState ??= squareOrder?.state ?? null;
      fulfillmentState = pickupState(squareOrder) ?? null;
    }

    if (orderState === "CANCELED" || fulfillmentState === "CANCELED") {
      await markOrderCanceled(order.id);
      return;
    }
    if (orderState === "COMPLETED") {
      await markOrderPickedUp(order.id);
      return;
    }
    if (fulfillmentState === "COMPLETED") {
      await markOrderPickedUp(order.id);
      return;
    }
    if (fulfillmentState === "PREPARED") {
      const ready = await markOrderReady(order.id);
      if (ready?.status === "READY" && !ready.readyEmailSentAt) {
        await enqueueOutbox("email.ready", { orderId: order.id });
      }
    }
    return;
  }

  if (event.type === "payment.updated") {
    const payment = extractPaymentDetails(event);
    if (!payment.orderId) return;
    if (payment.status === "COMPLETED" || payment.status === "APPROVED") {
      const paid = await markOrderPaidBySquareId(payment.orderId, payment.paymentId);
      if (paid && ["PAID", "READY"].includes(paid.status)) {
        await enqueueOutbox("email.confirmation", { orderId: paid.id });
        await reconcilePaidOrderFulfillment(paid);
      }
    }
    return;
  }

  if (event.type === "refund.updated") {
    const refund = extractRefundDetails(event);
    if (!refund.paymentId) return;
    if (refund.status && refund.status !== "COMPLETED") return;
    const order = await getOrderBySquarePaymentId(refund.paymentId);
    if (order) await markOrderRefunded(order.id);
  }
}

async function reconcilePaidOrderFulfillment(order: OrderRecord): Promise<void> {
  if (!order.squareOrderId) return;
  const squareOrder = await getSquareOrder(order.squareOrderId);
  const fulfillmentState = pickupState(squareOrder);
  if (fulfillmentState === "COMPLETED") {
    await markOrderPickedUp(order.id);
    return;
  }
  if (fulfillmentState !== "PREPARED") return;

  const ready = await markOrderReady(order.id);
  if (ready?.status === "READY" && !ready.readyEmailSentAt) {
    await enqueueOutbox("email.ready", { orderId: order.id });
  }
}

export interface OrderEventDetails {
  squareOrderId: string | null;
  orderState: string | null;
  fulfillmentState: string | null;
  order: SquareOrder | null;
}

export function extractOrderDetails(event: SquareWebhookEvent): OrderEventDetails {
  const object = asRecord(event.data?.object);
  const fullOrder = object && asRecord(object.order);
  const candidate = unwrapEventObject(object);
  if (!candidate && !fullOrder) {
    return { squareOrderId: null, orderState: null, fulfillmentState: null, order: null };
  }

  const order = isSquareOrder(candidate) ?? isSquareOrder(fullOrder);
  const isOrderEvent = event.type.startsWith("order.");
  const squareOrderId = firstString(
    candidate?.order_id,
    candidate?.orderId,
    order?.id,
    isOrderEvent ? candidate?.id : null
  );
  const fulfillments = (
    Array.isArray(candidate?.fulfillments)
      ? candidate.fulfillments
      : order?.fulfillments
  ) as SquareOrder["fulfillments"];
  const fulfillment = asRecord(candidate?.fulfillment);
  const fulfillmentUpdated = asRecord(candidate?.fulfillment_updated);

  return {
    squareOrderId,
    orderState: firstString(
      candidate?.state,
      candidate?.order_state,
      candidate?.orderState,
      order?.state
    ),
    fulfillmentState: firstString(
      candidate?.fulfillment_state,
      candidate?.fulfillmentState,
      fulfillment?.state,
      fulfillmentUpdated?.state,
      pickupState({ fulfillments })
    ),
    order
  };
}

export interface PaymentEventDetails {
  paymentId: string | null;
  orderId: string | null;
  status: string | null;
}

export function extractPaymentDetails(event: SquareWebhookEvent): PaymentEventDetails {
  const candidate = unwrapEventObject(asRecord(event.data?.object));
  return {
    paymentId: firstString(candidate?.payment_id, candidate?.paymentId, candidate?.id),
    orderId: firstString(candidate?.order_id, candidate?.orderId),
    status: firstString(candidate?.status)
  };
}

export interface RefundEventDetails {
  refundId: string | null;
  paymentId: string | null;
  status: string | null;
}

export function extractRefundDetails(event: SquareWebhookEvent): RefundEventDetails {
  const candidate = unwrapEventObject(asRecord(event.data?.object));
  return {
    refundId: firstString(candidate?.refund_id, candidate?.refundId, candidate?.id),
    paymentId: firstString(candidate?.payment_id, candidate?.paymentId),
    status: firstString(candidate?.status)
  };
}

function unwrapEventObject(
  object: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!object) return null;
  for (const key of [
    "order",
    "order_updated",
    "order_created",
    "order_fulfillment_updated",
    "payment",
    "payment_updated",
    "refund",
    "refund_updated"
  ]) {
    const nested = asRecord(object[key]);
    if (nested) return nested;
  }
  return object;
}

function pickupState(order: Pick<SquareOrder, "fulfillments"> | null): string | null {
  if (!order?.fulfillments?.length) return null;
  const pickup = order.fulfillments.find((fulfillment) => fulfillment.type === "PICKUP");
  return pickup?.state ?? order.fulfillments[0]?.state ?? null;
}

function isSquareOrder(value: Record<string, unknown> | null): SquareOrder | null {
  if (!value || typeof value.id !== "string") return null;
  return value as unknown as SquareOrder;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
