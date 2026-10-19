import { NextResponse } from "next/server";
import { clearStaffSession } from "@/lib/auth";

export async function POST() {
  await clearStaffSession();
  return NextResponse.json({ ok: true });
}
