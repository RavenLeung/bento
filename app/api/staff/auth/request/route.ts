import { NextResponse } from "next/server";
import { z } from "zod";
import { requestStaffOtp } from "@/lib/auth";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    await requestStaffOtp(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send code." },
      { status: 400 }
    );
  }
}
