import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuote, checkout } from "@/lib/services/checkout";
import { generateSlotTimes } from "@/lib/domain/slots";
import { getStoreSettings } from "@/lib/settings";
import { getOrderByToken } from "@/lib/repositories/orders";

describe("demo checkout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a paid demo order and returns it idempotently", async () => {
    const quote = await createQuote({
      boxItemId: "demo-box-regular",
      selections: [
        { itemId: "protein-karaage", quantity: 2 },
        { itemId: "veg-mixed-vegetables", quantity: 2 },
        { itemId: "starch-rice", quantity: 1 }
      ]
    });
    expect(quote.totalCents).toBe(2500);

    const settings = await getStoreSettings();
    const slot = generateSlotTimes(settings)[0];
    expect(slot).toBeDefined();

    const idempotencyKey = crypto.randomUUID();
    const input = {
      quoteToken: quote.quoteToken,
      paymentToken: "demo",
      customerName: "Test Eater",
      customerEmail: "test@example.com",
      pickupAt: slot.at,
      allergenAcknowledged: true as const,
      idempotencyKey
    };

    const order = await checkout(input);
    expect(order.status).toBe("PAID");
    expect(order.totalCents).toBe(2500);
    expect(order.lines).toHaveLength(3);

    const repeated = await checkout({ ...input, paymentToken: "demo-again" });
    expect(repeated.id).toBe(order.id);
    expect((await getOrderByToken(order.publicToken))?.status).toBe("PAID");
  });
});
