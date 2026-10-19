import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "@/lib/types";

const repositoryMocks = vi.hoisted(() => ({
  getOrderBySquareOrderId: vi.fn(),
  getOrderBySquarePaymentId: vi.fn(),
  markOrderCanceled: vi.fn(),
  markOrderPaidBySquareId: vi.fn(),
  markOrderPickedUp: vi.fn(),
  markOrderReady: vi.fn(),
  markOrderRefunded: vi.fn()
}));

const outboxMocks = vi.hoisted(() => ({
  enqueueOutbox: vi.fn()
}));

const squareMocks = vi.hoisted(() => ({
  getSquareOrder: vi.fn()
}));

vi.mock("@/lib/repositories/orders", () => repositoryMocks);
vi.mock("@/lib/outbox", () => outboxMocks);
vi.mock("@/lib/square/orders", () => squareMocks);

import {
  extractOrderDetails,
  extractPaymentDetails,
  extractRefundDetails,
  handleSquareEvent
} from "@/lib/webhooks";
import type { SquareWebhookEvent } from "@/lib/square/types";

function event(type: string, object: Record<string, unknown>): SquareWebhookEvent {
  return {
    event_id: "event-1",
    type,
    data: { type: type.replaceAll(".", "_"), id: "event-object", object }
  };
}

function orderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "local-order-1",
    publicToken: "order-token",
    orderCode: "B-TEST",
    status: "PAID",
    pickupAt: "2026-10-19T02:00:00.000Z",
    customerName: "Test Eater",
    customerEmail: "test@example.com",
    boxItemId: "demo-box-regular",
    boxName: "Regular Bento",
    boxCapacity: 6,
    subtotalCents: 1950,
    totalCents: 1950,
    currency: "AUD",
    idempotencyKey: "checkout-key",
    allergenAcknowledged: true,
    squareOrderId: "sq-order-1",
    squarePaymentId: null,
    paymentExpiresAt: null,
    createdAt: "2026-10-19T00:00:00.000Z",
    paidAt: "2026-10-19T00:01:00.000Z",
    readyAt: null,
    pickedUpAt: null,
    canceledAt: null,
    failureReason: null,
    readyEmailSentAt: null,
    lines: [],
    ...overrides
  };
}

describe("Square webhook parsing", () => {
  it("reads order.updated envelopes and fetches the full order later", () => {
    const details = extractOrderDetails(
      event("order.updated", {
        order_updated: {
          order_id: "sq-order-1",
          state: "OPEN",
          order_version: 4
        }
      })
    );

    expect(details).toMatchObject({
      squareOrderId: "sq-order-1",
      orderState: "OPEN",
      fulfillmentState: null,
      order: null
    });
  });

  it("reads fulfillment state from order.fulfillment.updated envelopes", () => {
    const details = extractOrderDetails(
      event("order.fulfillment.updated", {
        order_fulfillment_updated: {
          order_id: "sq-order-2",
          state: "OPEN",
          fulfillments: [
            { uid: "pickup-1", type: "PICKUP", state: "PREPARED" }
          ]
        }
      })
    );

    expect(details.squareOrderId).toBe("sq-order-2");
    expect(details.fulfillmentState).toBe("PREPARED");
  });

  it("accepts a full order wrapped under order", () => {
    const details = extractOrderDetails(
      event("order.updated", {
        order: {
          id: "sq-order-3",
          state: "COMPLETED",
          fulfillments: [{ type: "PICKUP", state: "COMPLETED" }]
        }
      })
    );

    expect(details.squareOrderId).toBe("sq-order-3");
    expect(details.orderState).toBe("COMPLETED");
    expect(details.fulfillmentState).toBe("COMPLETED");
    expect(details.order?.id).toBe("sq-order-3");
  });

  it("reads payment.updated envelopes", () => {
    expect(
      extractPaymentDetails(
        event("payment.updated", {
          payment_updated: {
            payment_id: "payment-1",
            order_id: "sq-order-4",
            status: "COMPLETED"
          }
        })
      )
    ).toEqual({
      paymentId: "payment-1",
      orderId: "sq-order-4",
      status: "COMPLETED"
    });
  });

  it("reads full payment objects", () => {
    expect(
      extractPaymentDetails(
        event("payment.updated", {
          payment: { id: "payment-2", order_id: "sq-order-5", status: "APPROVED" }
        })
      )
    ).toEqual({
      paymentId: "payment-2",
      orderId: "sq-order-5",
      status: "APPROVED"
    });
  });

  it("reads refund.updated envelopes", () => {
    expect(
      extractRefundDetails(
        event("refund.updated", {
          refund_updated: {
            refund_id: "refund-1",
            payment_id: "payment-3",
            status: "COMPLETED"
          }
        })
      )
    ).toEqual({
      refundId: "refund-1",
      paymentId: "payment-3",
      status: "COMPLETED"
    });
  });
});

describe("Square webhook state transitions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMocks.getOrderBySquareOrderId.mockResolvedValue(orderRecord());
  });

  it("marks a local order picked up when Square completes the pickup fulfillment", async () => {
    await handleSquareEvent(
      event("order.fulfillment.updated", {
        order_fulfillment_updated: {
          order_id: "sq-order-1",
          state: "OPEN",
          fulfillments: [{ uid: "pickup-1", type: "PICKUP", state: "COMPLETED" }]
        }
      })
    );

    expect(repositoryMocks.markOrderPickedUp).toHaveBeenCalledWith("local-order-1");
  });

  it("does not ready an unpaid order or queue a Ready email", async () => {
    const unpaid = orderRecord({ status: "PENDING_PAYMENT", paidAt: null });
    repositoryMocks.getOrderBySquareOrderId.mockResolvedValue(unpaid);
    repositoryMocks.markOrderReady.mockResolvedValue(unpaid);

    await handleSquareEvent(
      event("order.fulfillment.updated", {
        order_fulfillment_updated: {
          order_id: "sq-order-1",
          state: "OPEN",
          fulfillments: [{ uid: "pickup-1", type: "PICKUP", state: "PREPARED" }]
        }
      })
    );

    expect(repositoryMocks.markOrderReady).toHaveBeenCalledWith("local-order-1");
    expect(outboxMocks.enqueueOutbox).not.toHaveBeenCalled();
  });

  it("queues one Ready email after a paid order becomes ready", async () => {
    repositoryMocks.markOrderReady.mockResolvedValue(
      orderRecord({ status: "READY", readyAt: "2026-10-19T00:05:00.000Z" })
    );

    await handleSquareEvent(
      event("order.fulfillment.updated", {
        order_fulfillment_updated: {
          order_id: "sq-order-1",
          state: "OPEN",
          fulfillments: [{ uid: "pickup-1", type: "PICKUP", state: "PREPARED" }]
        }
      })
    );

    expect(outboxMocks.enqueueOutbox).toHaveBeenCalledWith("email.ready", {
      orderId: "local-order-1"
    });
  });

  it("catches up a late payment when the Square pickup is already prepared", async () => {
    repositoryMocks.markOrderPaidBySquareId.mockResolvedValue(orderRecord({ status: "PAID" }));
    repositoryMocks.markOrderReady.mockResolvedValue(
      orderRecord({ status: "READY", readyAt: "2026-10-19T00:05:00.000Z" })
    );
    squareMocks.getSquareOrder.mockResolvedValue({
      id: "sq-order-1",
      fulfillments: [{ uid: "pickup-1", type: "PICKUP", state: "PREPARED" }]
    });

    await handleSquareEvent(
      event("payment.updated", {
        payment: { id: "payment-1", order_id: "sq-order-1", status: "COMPLETED" }
      })
    );

    expect(outboxMocks.enqueueOutbox).toHaveBeenCalledWith("email.confirmation", {
      orderId: "local-order-1"
    });
    expect(repositoryMocks.markOrderReady).toHaveBeenCalledWith("local-order-1");
    expect(outboxMocks.enqueueOutbox).toHaveBeenCalledWith("email.ready", {
      orderId: "local-order-1"
    });
  });
});
