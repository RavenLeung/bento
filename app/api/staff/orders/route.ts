import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { listOrdersForToday } from "@/lib/repositories/orders";
import { toStaffOrder } from "@/lib/serializers";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const settings = await getStoreSettings();
  const orders = await listOrdersForToday(settings.timezone);
  return NextResponse.json(
    { orders: orders.map(toStaffOrder), serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
