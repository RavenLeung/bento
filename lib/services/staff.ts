import { isDemoMode } from "@/lib/config";
import { enqueueOutbox } from "@/lib/outbox";
import {
  getOrderById,
  markOrderPickedUp,
  markOrderReady
} from "@/lib/repositories/orders";
import { updateSquareFulfillmentState } from "@/lib/square/orders";
import { AppError, type OrderRecord } from "@/lib/types";

export interface StaffActionResult {
  order: OrderRecord;
  squareSynced: boolean;
  warning: string | null;
}

export async function markOrderReadyForStaff(orderId: string): Promise<StaffActionResult> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new AppError("NOT_FOUND", "Order not found.", 404);
  }
  if (!["PAID", "READY"].includes(order.status)) {
    throw new AppError("BAD_REQUEST", "Only paid orders can be marked ready.", 409);
  }

  const alreadyReady = order.status === "READY";
  const square = await syncSquareState(order, "PREPARED");
  const updated = alreadyReady ? order : await markOrderReady(order.id);
  if (!updated) {
    throw new AppError("INTERNAL_ERROR", "Unable to update the order.", 500);
  }
  if (!updated.readyEmailSentAt) {
    await enqueueOutbox("email.ready", { orderId: updated.id });
  }
  return { order: updated, squareSynced: square.synced, warning: square.warning };
}

export async function markOrderPickedUpForStaff(orderId: string): Promise<StaffActionResult> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new AppError("NOT_FOUND", "Order not found.", 404);
  }
  if (!["PAID", "READY", "PICKED_UP"].includes(order.status)) {
    throw new AppError("BAD_REQUEST", "This order cannot be marked as picked up.", 409);
  }

  const alreadyPickedUp = order.status === "PICKED_UP";
  const square = await syncSquareState(order, "COMPLETED");
  const updated = alreadyPickedUp ? order : await markOrderPickedUp(order.id);
  if (!updated) {
    throw new AppError("INTERNAL_ERROR", "Unable to update the order.", 500);
  }
  return { order: updated, squareSynced: square.synced, warning: square.warning };
}

async function syncSquareState(
  order: OrderRecord,
  target: "PREPARED" | "COMPLETED"
): Promise<{ synced: boolean; warning: string | null }> {
  if (isDemoMode || !order.squareOrderId) {
    return { synced: isDemoMode, warning: null };
  }
  try {
    await updateSquareFulfillmentState(
      order.squareOrderId,
      target,
      target === "COMPLETED" ? "COMPLETED" : undefined
    );
    return { synced: true, warning: null };
  } catch (error) {
    console.error("Square fulfillment sync failed", order.orderCode, target, error);
    return {
      synced: false,
      warning: `Saved in Gemeshi Bento Lab, but Square could not be updated to ${target.toLowerCase()}. Check the Square order manually.`
    };
  }
}
