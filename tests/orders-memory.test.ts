import { describe, expect, it } from "vitest";
import {
  createOrderWithSlot,
  markOrderPaid,
  markOrderPickedUp,
  markOrderReady
} from "@/lib/repositories/orders";

async function createPendingOrder() {
  const order = await createOrderWithSlot({
    pickupAt: new Date("2026-10-20T02:00:00.000Z"),
    customerName: "Memory Tester",
    customerEmail: "memory@example.com",
    boxItemId: "demo-box-regular",
    boxName: "Regular Bento",
    boxCapacity: 6,
    subtotalCents: 850,
    totalCents: 850,
    currency: "AUD",
    idempotencyKey: crypto.randomUUID(),
    allergenAcknowledged: true,
    lines: [
      {
        itemId: "protein-karaage",
        name: "Chicken Karaage",
        section: "protein",
        unitPriceCents: 600,
        quantity: 1,
        lineTotalCents: 600,
        dietaryTags: [],
        allergens: []
      }
    ],
    slotCapacity: 100
  });

  expect(order).not.toBeNull();
  return order!;
}

describe("in-memory order transitions", () => {
  it("does not ready or pick up an unpaid order", async () => {
    const order = await createPendingOrder();

    expect((await markOrderReady(order.id))?.status).toBe("PENDING_PAYMENT");
    expect((await markOrderPickedUp(order.id))?.status).toBe("PENDING_PAYMENT");
  });

  it("moves a paid order through ready and picked up", async () => {
    const order = await createPendingOrder();

    expect((await markOrderPaid(order.id, "payment-1"))?.status).toBe("PAID");
    expect((await markOrderReady(order.id))?.status).toBe("READY");
    expect((await markOrderPickedUp(order.id))?.status).toBe("PICKED_UP");
  });
});
