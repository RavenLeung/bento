import { sendEmail } from "@/lib/email/send";
import { confirmationEmail, readyEmail } from "@/lib/email/templates";
import { markReadyEmailSent } from "@/lib/repositories/orders";
import type { OrderRecord } from "@/lib/types";

export async function sendConfirmation(order: OrderRecord): Promise<void> {
  const template = confirmationEmail(order);
  await sendEmail({ to: order.customerEmail, ...template });
}

export async function sendReadyIfNeeded(order: OrderRecord): Promise<boolean> {
  if (order.readyEmailSentAt) return false;
  const template = readyEmail(order);
  await sendEmail({ to: order.customerEmail, ...template });
  await markReadyEmailSent(order.id);
  return true;
}
