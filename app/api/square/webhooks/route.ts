import { NextResponse } from "next/server";
import { getAppUrl, isDemoMode, squareConfig } from "@/lib/config";
import { verifySquareWebhookSignature } from "@/lib/square/client";
import type { SquareWebhookEvent } from "@/lib/square/types";
import { processSquareEvent, storeSquareEvent } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const notificationUrl = `${getAppUrl(request.url)}/api/square/webhooks`;

  if (squareConfig.webhookSignatureKey) {
    if (!verifySquareWebhookSignature(rawBody, signature, notificationUrl)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else if (!isDemoMode) {
    return NextResponse.json({ error: "Webhook signing key is not configured." }, { status: 503 });
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody) as SquareWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!event.event_id || !event.type) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  await storeSquareEvent(event);
  await processSquareEvent(event.event_id);
  return NextResponse.json({ received: true });
}
