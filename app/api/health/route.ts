import { NextResponse } from "next/server";
import { getMissingProductionConfig, isDemoMode, isSquareConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const missingConfig = getMissingProductionConfig();
  return NextResponse.json(
    {
      ok: missingConfig.length === 0,
      demoMode: isDemoMode,
      squareConfigured: isSquareConfigured,
      missingConfig,
      timestamp: new Date().toISOString()
    },
    { status: missingConfig.length === 0 ? 200 : 503 }
  );
}
