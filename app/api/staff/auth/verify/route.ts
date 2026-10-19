import { NextResponse } from "next/server";
import { z } from "zod";
import { setStaffSession, verifyStaffOtp } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), code: z.string().length(6) });

export async function POST(request: Request) {
  try {
    const { email, code } = schema.parse(await request.json());
    if (!(await verifyStaffOtp(email, code))) {
      return NextResponse.json({ error: "That code is invalid or expired." }, { status: 401 });
    }
    await setStaffSession(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 400 }
    );
  }
}
