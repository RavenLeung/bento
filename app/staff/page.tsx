import type { Metadata } from "next";
import { StaffDashboard } from "@/components/StaffDashboard";
import { requireStaff } from "@/lib/auth";
import { listOrdersForToday } from "@/lib/repositories/orders";
import { toStaffOrder } from "@/lib/serializers";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen",
  robots: { index: false, follow: false }
};

export default async function StaffPage() {
  const session = await requireStaff();
  const settings = await getStoreSettings();
  const orders = await listOrdersForToday(settings.timezone);
  return (
    <StaffDashboard
      initialOrders={orders.map(toStaffOrder)}
      initialSettings={settings}
      staffEmail={session.email}
    />
  );
}
