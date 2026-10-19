import { generateSlotTimes, withAvailability } from "@/lib/domain/slots";
import { countBookingsBySlot } from "@/lib/repositories/orders";
import { getStoreSettings } from "@/lib/settings";
import type { PickupSlot } from "@/lib/types";

export async function getPickupAvailability(): Promise<{
  slots: PickupSlot[];
  timezone: string;
  acceptingOrders: boolean;
}> {
  const settings = await getStoreSettings();
  const times = generateSlotTimes(settings);
  const counts = await countBookingsBySlot(settings.timezone);
  return {
    slots: withAvailability(times, settings, counts),
    timezone: settings.timezone,
    acceptingOrders: settings.acceptingOrders
  };
}
