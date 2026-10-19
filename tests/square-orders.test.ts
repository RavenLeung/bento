import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "@/lib/types";

const squareMocks = vi.hoisted(() => ({
  squareFetch: vi.fn()
}));

vi.mock("@/lib/square/client", () => ({
  squareFetch: squareMocks.squareFetch,
  SquareApiError: class SquareApiError extends Error {}
}));

import { createSquarePayment } from "@/lib/square/orders";

function orderRecord(): OrderRecord {
  return {
    id: "local-order-1",
    publicToken: "order-token",
    orderCode: "B-TEST",
    status: "PENDING_PAYMENT",
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
    squareOrderId: null,
    squarePaymentId: null,
    paymentExpiresAt: null,
    createdAt: "2026-10-19T00:00:00.000Z",
    paidAt: null,
    readyAt: null,
    pickedUpAt: null,
    canceledAt: null,
    failureReason: null,
    readyEmailSentAt: null,
    lines: []
  };
}

describe("Square payment idempotency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    squareMocks.squareFetch.mockResolvedValue({
      payment: { id: "square-payment-1", status: "COMPLETED" }
    });
  });

  it("uses the caller's payment attempt key", async () => {
    await createSquarePayment(
      orderRecord(),
      "square-order-1",
      1950,
      "card-token",
      "payment-attempt-key"
    );

    const body = JSON.parse(String(squareMocks.squareFetch.mock.calls[0][1].body));
    expect(body.idempotency_key).toBe("payment:payment-attempt-key");
  });

  it("falls back to the checkout key when no attempt key is supplied", async () => {
    await createSquarePayment(orderRecord(), "square-order-1", 1950, "card-token");

    const body = JSON.parse(String(squareMocks.squareFetch.mock.calls[0][1].body));
    expect(body.idempotency_key).toBe("payment:checkout-key");
  });
});
