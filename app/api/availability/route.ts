import { NextResponse } from "next/server";
import { getPickupAvailability } from "@/lib/services/availability";
import { AppError } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPickupAvailability(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load pickup times." },
      { status }
    );
  }
}
