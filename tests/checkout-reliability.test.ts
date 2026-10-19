import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CATALOG } from "@/lib/demo-catalog";
import { generateSlotTimes } from "@/lib/domain/slots";
import { SquareApiError } from "@/lib/square/client";
import type { OrderRecord, Quote, StoreSettings } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getCatalogSnapshot: vi.fn(),
  getStoreSettings: vi.fn(),
  findOrderByIdempotencyKey: vi.fn(),
  createOrderWithSlot: vi.fn(),
  attachSquareOrder: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderFailed: vi.fn(),
  enqueueOutbox: vi.fn(),
  createSquareOrder: vi.fn(),
  createSquarePayment: vi.fn(),
  cancelSquareOrder: vi.fn()
}));

vi.mock("@/lib/config", () => ({
  env: {
    STORE_CURRENCY: "AUD",
    STORE_TIMEZONE: "Australia/Sydney",
    AUTH_SECRET: "test-secret"
  },
  isDemoMode: false,
  isSquareConfigured: true,
  squareConfig: {
    environment: "sandbox",
    accessToken: "test-token",
    locationId: "test-location",
    applicationId: "test-app",
    webhookSignatureKey: "test-webhook-key",
    apiVersion: "2026-09-16",
    baseUrl: "https://connect.squareupsandbox.com",
    categories: { box: "", protein: "", vegetable: "", starch: "" }
  },
  publicConfig: { appUrl: "https://shop.example.com" },
  staffEmails: new Set(["staff@example.com"]),
  getAppUrl: () => "https://shop.example.com",
  getMissingProductionConfig: () => [],
  assertProductionConfig: () => undefined
}));

vi.mock("@/lib/catalog", () => ({ getCatalogSnapshot: mocks.getCatalogSnapshot }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.getStoreSettings }));
vi.mock("@/lib/repositories/orders", () => ({
  findOrderByIdempotencyKey: mocks.findOrderByIdempotencyKey,
  createOrderWithSlot: mocks.createOrderWithSlot,
  attachSquareOrder: mocks.attachSquareOrder,
  markOrderPaid: mocks.markOrderPaid,
  markOrderFailed: mocks.markOrderFailed
}));
vi.mock("@/lib/outbox", () => ({ enqueueOutbox: mocks.enqueueOutbox }));
vi.mock("@/lib/square/orders", () => ({
  createSquareOrder: mocks.createSquareOrder,
  createSquarePayment: mocks.createSquarePayment,
  cancelSquareOrder: mocks.cancelSquareOrder
}));

import { checkout, createQuote } from "@/lib/services/checkout";

const SETTINGS: StoreSettings = {
  acceptingOrders: true,
  prepLeadMinutes: 12,
  slotMinutes: 10,
  slotCapacity: 6,
  openTime: "10:00",
  closeTime: "20:00",
  timezone: "Australia/Sydney"
};

async function checkoutFixture() {
  const quote = await createQuote({
    boxItemId: "demo-box-regular",
    selections: [
      { itemId: "protein-karaage", quantity: 2 },
      { itemId: "veg-mixed-vegetables", quantity: 2 },
      { itemId: "starch-rice", quantity: 1 }
    ]
  });
  const slot = generateSlotTimes(SETTINGS)[0];
  const idempotencyKey = crypto.randomUUID();
  const paymentAttemptKey = crypto.randomUUID();
  const input = {
    quoteToken: quote.quoteToken,
    paymentToken: "card-token",
    customerName: "Test Eater",
    customerEmail: "test@example.com",
    pickupAt: slot.at,
    allergenAcknowledged: true as const,
    idempotencyKey,
    paymentAttemptKey
  };
  return { quote, input, order: pendingOrder(quote, slot.at, idempotencyKey) };
}

function pendingOrder(quote: Quote, pickupAt: string, idempotencyKey: string): OrderRecord {
  return {
    id: "local-order-1",
    publicToken: "order-token",
    orderCode: "B-TEST",
    status: "PENDING_PAYMENT",
    pickupAt,
    customerName: "Test Eater",
    customerEmail: "test@example.com",
    boxItemId: quote.boxItemId,
    boxName: quote.boxName,
    boxCapacity: quote.boxCapacity,
    subtotalCents: quote.totalCents,
    totalCents: quote.totalCents,
    currency: quote.currency,
    idempotencyKey,
    allergenAcknowledged: true,
    squareOrderId: null,
    squarePaymentId: null,
    paymentExpiresAt: "2026-10-19T00:05:00.000Z",
    createdAt: "2026-10-19T00:00:00.000Z",
    paidAt: null,
    readyAt: null,
    pickedUpAt: null,
    canceledAt: null,
    failureReason: null,
    readyEmailSentAt: null,
    lines: quote.lines.map((line, index) => ({
      id: `line-${index}`,
      catalogItemId: line.itemId,
      name: line.name,
      section: line.section,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents
    }))
  };
}

describe("Square checkout reliability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00.000Z"));
    vi.resetAllMocks();
    mocks.getCatalogSnapshot.mockResolvedValue({
      items: DEMO_CATALOG,
      source: "demo",
      syncedAt: "2026-10-19T00:00:00.000Z"
    });
    mocks.getStoreSettings.mockResolvedValue(SETTINGS);
    mocks.attachSquareOrder.mockResolvedValue(undefined);
    mocks.enqueueOutbox.mockResolvedValue(undefined);
    mocks.cancelSquareOrder.mockResolvedValue(undefined);
    mocks.markOrderFailed.mockResolvedValue(undefined);
    mocks.createSquareOrder.mockImplementation(async (order: OrderRecord) => ({
      id: "square-order-1",
      total_money: { amount: order.totalCents, currency: order.currency }
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns PAYMENT_UNCERTAIN and keeps the pending order on an ambiguous Square error", async () => {
    const { quote, input, order } = await checkoutFixture();
    mocks.findOrderByIdempotencyKey.mockResolvedValue(null);
    mocks.createOrderWithSlot.mockResolvedValue(order);
    mocks.createSquarePayment.mockRejectedValue(new SquareApiError(500, { errors: [] }));

    await expect(checkout(input)).rejects.toMatchObject({ code: "PAYMENT_UNCERTAIN" });

    expect(mocks.markOrderFailed).not.toHaveBeenCalled();
    expect(mocks.cancelSquareOrder).not.toHaveBeenCalled();
    expect(mocks.createSquarePayment).toHaveBeenCalledWith(
      order,
      "square-order-1",
      quote.totalCents,
      "card-token",
      input.paymentAttemptKey
    );
  });

  it("reuses the same payment attempt key when an uncertain checkout is retried", async () => {
    const { input, order } = await checkoutFixture();
    mocks.findOrderByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValue(order);
    mocks.createOrderWithSlot.mockResolvedValue(order);
    mocks.createSquarePayment.mockRejectedValue(new SquareApiError(503, { errors: [] }));

    await expect(checkout(input)).rejects.toMatchObject({ code: "PAYMENT_UNCERTAIN" });
    await expect(checkout(input)).rejects.toMatchObject({ code: "PAYMENT_UNCERTAIN" });

    expect(mocks.createSquarePayment).toHaveBeenCalledTimes(2);
    expect(mocks.createSquarePayment.mock.calls[0][4]).toBe(input.paymentAttemptKey);
    expect(mocks.createSquarePayment.mock.calls[1][4]).toBe(input.paymentAttemptKey);
    expect(mocks.createSquareOrder.mock.calls[0][0].idempotencyKey).toBe(input.idempotencyKey);
    expect(mocks.createSquareOrder.mock.calls[1][0].idempotencyKey).toBe(input.idempotencyKey);
  });

  it("treats a card decline as definitive and closes the local attempt", async () => {
    const { input, order } = await checkoutFixture();
    mocks.findOrderByIdempotencyKey.mockResolvedValue(null);
    mocks.createOrderWithSlot.mockResolvedValue(order);
    mocks.createSquarePayment.mockRejectedValue(new SquareApiError(402, { errors: [] }));

    await expect(checkout(input)).rejects.toMatchObject({ code: "PAYMENT_DECLINED" });

    expect(mocks.cancelSquareOrder).toHaveBeenCalledWith("square-order-1");
    expect(mocks.markOrderFailed).toHaveBeenCalledWith("local-order-1", expect.any(String));
  });

  it("re-queues the confirmation email when an already paid checkout is replayed", async () => {
    const { input, order } = await checkoutFixture();
    mocks.findOrderByIdempotencyKey.mockResolvedValue({
      ...order,
      status: "PAID",
      squarePaymentId: "square-payment-1",
      paidAt: "2026-10-19T00:01:00.000Z",
      paymentExpiresAt: null
    });

    const paid = await checkout(input);

    expect(paid.id).toBe(order.id);
    expect(mocks.enqueueOutbox).toHaveBeenCalledWith("email.confirmation", {
      orderId: order.id
    });
  });
});
