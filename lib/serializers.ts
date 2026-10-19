import type { OrderRecord, PublicOrder, StaffOrderView } from "@/lib/types";

export function toPublicOrder(order: OrderRecord): PublicOrder {
  return {
    orderCode: order.orderCode,
    status: order.status,
    pickupAt: order.pickupAt,
    customerName: order.customerName,
    boxName: order.boxName,
    totalCents: order.totalCents,
    currency: order.currency,
    lines: order.lines,
    createdAt: order.createdAt,
    readyAt: order.readyAt
  };
}

export function toStaffOrder(order: OrderRecord): StaffOrderView {
  return {
    ...toPublicOrder(order),
    id: order.id,
    customerEmail: order.customerEmail,
    boxCapacity: order.boxCapacity,
    paidAt: order.paidAt,
    pickedUpAt: order.pickedUpAt,
    readyEmailSentAt: order.readyEmailSentAt
  };
}
