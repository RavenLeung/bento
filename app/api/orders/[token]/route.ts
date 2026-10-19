import { NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/repositories/orders";
import { toPublicOrder } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const order = await getOrderByToken(token);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json(toPublicOrder(order), {
    headers: { "Cache-Control": "no-store" }
  });
}
