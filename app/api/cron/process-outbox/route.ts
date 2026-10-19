import { NextResponse } from "next/server";
import { env, isDemoMode, isShowcaseMode } from "@/lib/config";
import { processOutbox } from "@/lib/outbox";
import { cleanupExpiredPendingOrders } from "@/lib/repositories/orders";
import { processPendingWebhookEvents } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (isShowcaseMode) {
    return NextResponse.json({ skipped: true, reason: "Showcase mode has no background jobs." });
  }

  if (env.CRON_SECRET) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  } else if (!isDemoMode) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const [cleaned, outbox, webhookCount] = await Promise.all([
    cleanupExpiredPendingOrders(),
    processOutbox(20),
    processPendingWebhookEvents(20)
  ]);
  return NextResponse.json({ cleaned, outbox, webhookCount });
}
