import { env } from "@/lib/config";
import { sqlClient } from "@/lib/db/client";
import type { StoreSettings } from "@/lib/types";

const DEFAULTS: StoreSettings = {
  acceptingOrders: true,
  prepLeadMinutes: 12,
  slotMinutes: 10,
  slotCapacity: 6,
  openTime: "10:00",
  closeTime: "20:00",
  timezone: env.STORE_TIMEZONE
};

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!sqlClient) return DEFAULTS;
  try {
    const [row] = await sqlClient<Array<Record<string, unknown>>>`
      select accepting_orders, prep_lead_minutes, slot_minutes, slot_capacity,
             open_time, close_time, timezone
      from settings where id = 'default' limit 1
    `;
    if (!row) return DEFAULTS;
    return {
      acceptingOrders: Boolean(row.accepting_orders),
      prepLeadMinutes: Number(row.prep_lead_minutes),
      slotMinutes: Number(row.slot_minutes),
      slotCapacity: Number(row.slot_capacity),
      openTime: String(row.open_time),
      closeTime: String(row.close_time),
      timezone: String(row.timezone)
    };
  } catch {
    return DEFAULTS;
  }
}

export async function updateStoreSettings(values: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const next = { ...current, ...values, timezone: env.STORE_TIMEZONE };
  if (sqlClient) {
    await sqlClient`
      insert into settings (id, accepting_orders, prep_lead_minutes, slot_minutes, slot_capacity, open_time, close_time, timezone, updated_at)
      values ('default', ${next.acceptingOrders}, ${next.prepLeadMinutes}, ${next.slotMinutes}, ${next.slotCapacity}, ${next.openTime}, ${next.closeTime}, ${next.timezone}, now())
      on conflict (id) do update set
        accepting_orders = excluded.accepting_orders,
        prep_lead_minutes = excluded.prep_lead_minutes,
        slot_minutes = excluded.slot_minutes,
        slot_capacity = excluded.slot_capacity,
        open_time = excluded.open_time,
        close_time = excluded.close_time,
        timezone = excluded.timezone,
        updated_at = now()
    `;
  }
  return next;
}
