import { DateTime } from "luxon";
import type { PickupSlot, StoreSettings } from "@/lib/types";

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

export function generateSlotTimes(
  settings: StoreSettings,
  now = new Date()
): { at: string; label: string }[] {
  const zone = settings.timezone;
  const current = DateTime.fromJSDate(now, { zone });
  const day = current.startOf("day");
  const open = parseTime(settings.openTime);
  const close = parseTime(settings.closeTime);
  const opening = day.set({ hour: open.hour, minute: open.minute });
  const closing = day.set({ hour: close.hour, minute: close.minute });
  if (!settings.acceptingOrders || !opening.isValid || !closing.isValid || closing <= opening) {
    return [];
  }
  const earliest = current.plus({ minutes: settings.prepLeadMinutes });
  const interval = Math.max(5, settings.slotMinutes);

  let cursor = opening;
  if (earliest > cursor) {
    const diffMinutes = earliest.diff(opening, "minutes").minutes;
    const slotsToSkip = Math.ceil(diffMinutes / interval);
    cursor = opening.plus({ minutes: slotsToSkip * interval });
  }

  const result: { at: string; label: string }[] = [];
  while (cursor.plus({ minutes: interval }) <= closing) {
    result.push({
      at: cursor.toUTC().toISO()!,
      label: cursor.toFormat("h:mm a")
    });
    cursor = cursor.plus({ minutes: interval });
  }

  return result;
}

export function withAvailability(
  times: { at: string; label: string }[],
  settings: StoreSettings,
  counts: Map<string, number>
): PickupSlot[] {
  return times.map((time) => {
    const booked = counts.get(time.at) ?? 0;
    return {
      ...time,
      capacity: settings.slotCapacity,
      booked,
      remaining: Math.max(0, settings.slotCapacity - booked)
    };
  });
}

export function formatPickupTime(value: string, timezone: string): string {
  return DateTime.fromISO(value, { setZone: true })
    .setZone(timezone)
    .toFormat("ccc d LLL, h:mm a");
}

export function todayKey(timezone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate()!;
}

export function startOfTodayUtc(timezone: string, now = new Date()): Date {
  return DateTime.fromJSDate(now, { zone: timezone }).startOf("day").toUTC().toJSDate();
}

export function endOfTodayUtc(timezone: string, now = new Date()): Date {
  return DateTime.fromJSDate(now, { zone: timezone }).endOf("day").toUTC().toJSDate();
}
