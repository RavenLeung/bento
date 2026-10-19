import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/lib/catalog";
import { AppError } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getCatalogSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    console.error("Menu unavailable", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the menu." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
