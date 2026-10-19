import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DISABLED_API_PREFIXES = ["/api/staff", "/api/checkout", "/api/quote"];

export function proxy(request: NextRequest) {
  if (process.env.SHOWCASE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (DISABLED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.json(
      { error: "This feature is disabled in the interactive showcase." },
      { status: 404 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/staff",
    "/staff/:path*",
    "/api/staff",
    "/api/staff/:path*",
    "/api/checkout",
    "/api/quote"
  ]
};
