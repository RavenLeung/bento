import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { generateSlotTimes } from "@/lib/domain/slots";
import type { StoreSettings } from "@/lib/types";

const settings: StoreSettings = {
  acceptingOrders: true,
  prepLeadMinutes: 12,
  slotMinutes: 10,
  slotCapacity: 6,
  openTime: "10:00",
  closeTime: "20:00",
  timezone: "Australia/Sydney"
};

function sydney(value: string) {
  return DateTime.fromISO(value, { zone: settings.timezone }).toJSDate();
}

describe("generateSlotTimes", () => {
  it("aligns the first slot after the prep lead time", () => {
    const slots = generateSlotTimes(settings, sydney("2026-10-19T12:03:00"));
    expect(slots[0]?.label).toBe("12:20 PM");
    expect(slots.at(-1)?.label).toBe("7:50 PM");
  });

  it("returns no slots when the shop is closed", () => {
    expect(generateSlotTimes(settings, sydney("2026-10-19T21:30:00"))).toEqual([]);
  });

  it("returns no slots when ordering is paused", () => {
    expect(
      generateSlotTimes({ ...settings, acceptingOrders: false }, sydney("2026-10-19T11:00:00"))
    ).toEqual([]);
  });

  it("does not create fallback slots near closing time", () => {
    expect(generateSlotTimes(settings, sydney("2026-10-19T19:55:00"))).toEqual([]);
  });

  it("honours validated opening hours", () => {
    expect(
      generateSlotTimes({ ...settings, openTime: "20:00", closeTime: "10:00" }, sydney("2026-10-19T11:00:00"))
    ).toEqual([]);
  });
});
