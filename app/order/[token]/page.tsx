import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusClient } from "@/components/OrderStatusClient";
import { publicConfig } from "@/lib/config";
import { getOrderByToken } from "@/lib/repositories/orders";
import { toPublicOrder } from "@/lib/serializers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const order = await getOrderByToken(token);
  return {
    title: order ? `Order ${order.orderCode}` : "Order not found",
    robots: { index: false, follow: false }
  };
}

export default async function OrderPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  return (
    <OrderStatusClient
      token={token}
      initialOrder={toPublicOrder(order)}
      config={publicConfig}
      showConfirmation={query.new === "1"}
    />
  );
}
