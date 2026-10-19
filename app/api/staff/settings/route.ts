import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { getStoreSettings, updateStoreSettings } from "@/lib/settings";
import { AppError } from "@/lib/types";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
const schema = z
  .object({
    acceptingOrders: z.boolean().optional(),
    prepLeadMinutes: z.number().int().min(0).max(120).optional(),
    slotMinutes: z.number().int().min(5).max(60).optional(),
    slotCapacity: z.number().int().min(1).max(50).optional(),
    openTime: time.optional(),
    closeTime: time.optional()
  })
  .refine((value) => !value.openTime || !value.closeTime || value.openTime < value.closeTime, {
    message: "Closing time must be after opening time."
  });

export async function GET() {
  if (!(await getStaffSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await getStoreSettings());
}

export async function PUT(request: Request) {
  if (!(await getStaffSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const values = schema.parse(await request.json());
    const current = await getStoreSettings();
    if ((values.openTime ?? current.openTime) >= (values.closeTime ?? current.closeTime)) {
      return NextResponse.json({ error: "Closing time must be after opening time." }, { status: 400 });
    }
    return NextResponse.json(await updateStoreSettings(values));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid settings." },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to save settings." }, { status: 500 });
  }
}
