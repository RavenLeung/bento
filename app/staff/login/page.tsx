import { redirect } from "next/navigation";
import { StaffLogin } from "@/components/StaffLogin";
import { getStaffSession } from "@/lib/auth";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage() {
  if (await getStaffSession()) redirect("/staff");
  return <StaffLogin storeName={publicConfig.storeName} />;
}
