import { escapeHtml, formatMoney } from "@/lib/utils";
import { formatPickupTime } from "@/lib/domain/slots";
import { env, getAppUrl, publicConfig } from "@/lib/config";
import type { OrderRecord } from "@/lib/types";

function shell(title: string, content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f2e8;color:#1c241f;font-family:Avenir Next,Avenir,system-ui,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 18px 48px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#3f7a5d;font-weight:700">Bento Lab</div>
      <div style="background:#fffdf8;border:1px solid #e6ddcc;border-radius:24px;padding:28px;margin-top:16px;box-shadow:0 14px 40px rgba(28,36,31,.08)">
        <h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">${title}</h1>
        ${content}
      </div>
      <p style="font-size:12px;line-height:1.6;color:#68756d;margin-top:20px">Prepared in a kitchen that handles fish, shellfish, egg, milk, soy, sesame, gluten and nuts. We cannot guarantee an allergen-free environment.</p>
    </div>
  </body>
</html>`;
}

function lineItems(order: OrderRecord): string {
  return order.lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee7da">${escapeHtml(line.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee7da;text-align:center">×${line.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee7da;text-align:right">${formatMoney(line.lineTotalCents, order.currency)}</td>
      </tr>`
    )
    .join("");
}

export function confirmationEmail(order: OrderRecord): { subject: string; html: string } {
  const statusUrl = `${getAppUrl()}/order/${order.publicToken}`;
  return {
    subject: `Order ${order.orderCode} confirmed · ${formatPickupTime(order.pickupAt, publicConfig.timezone)}`,
    html: shell(
      "Your bento is in the queue.",
      `<p style="font-size:16px;line-height:1.6;margin:0 0 18px">Hi ${escapeHtml(order.customerName.split(" ")[0] || "there")}, we have your order <strong>${escapeHtml(order.orderCode)}</strong> for <strong>${escapeHtml(formatPickupTime(order.pickupAt, publicConfig.timezone))}</strong>.</p>
      <div style="background:#f7f2e8;border-radius:16px;padding:16px;margin:18px 0">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#68756d">${escapeHtml(order.boxName)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">${lineItems(order)}</table>
        <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:18px;font-weight:700"><span>Total</span><span>${formatMoney(order.totalCents, order.currency)}</span></div>
        <div style="font-size:12px;color:#68756d;margin-top:4px">GST included</div>
      </div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">We will email you again the moment it is ready. You can also follow along live.</p>
      <a href="${statusUrl}" style="display:inline-block;background:#244f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px">Track order</a>
      <p style="font-size:13px;line-height:1.6;color:#68756d;margin-top:20px">Pickup at ${escapeHtml(env.STORE_ADDRESS)}. Show your order code at the counter.</p>`
    )
  };
}

export function readyEmail(order: OrderRecord): { subject: string; html: string } {
  const statusUrl = `${getAppUrl()}/order/${order.publicToken}`;
  return {
    subject: `Bento ${order.orderCode} is ready for pickup`,
    html: shell(
      "Your bento is ready.",
      `<div style="font-size:64px;line-height:1;margin-bottom:16px">🍱</div>
      <p style="font-size:18px;line-height:1.6;margin:0 0 18px">Order <strong>${escapeHtml(order.orderCode)}</strong> is packed and waiting at the counter.</p>
      <div style="background:#f4c95d;border-radius:18px;padding:18px;margin:22px 0;font-size:32px;font-weight:800;letter-spacing:.08em;text-align:center">${escapeHtml(order.orderCode)}</div>
      <p style="font-size:15px;line-height:1.6;color:#4b5b50">Pickup: ${escapeHtml(formatPickupTime(order.pickupAt, publicConfig.timezone))}<br/>${escapeHtml(env.STORE_ADDRESS)}</p>
      <a href="${statusUrl}" style="display:inline-block;background:#244f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px;margin-top:10px">View order</a>`
    )
  };
}

export function staffOtpEmail(code: string): { subject: string; html: string } {
  return {
    subject: `Your Bento Lab staff code: ${code}`,
    html: shell(
      "Staff sign-in code",
      `<p style="font-size:15px;line-height:1.6;margin:0 0 18px">Use this one-time code to open the staff order list. It expires in 10 minutes.</p>
      <div style="font-size:38px;letter-spacing:.22em;font-weight:800;background:#f4c95d;border-radius:16px;padding:18px;text-align:center">${code}</div>
      <p style="font-size:13px;color:#68756d;margin-top:20px">If you did not request this, you can ignore it.</p>`
    )
  };
}
