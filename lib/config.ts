import { z } from "zod";
import type { PublicConfig } from "@/lib/types";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  STORE_NAME: z.string().default("Gemeshi Bento Lab"),
  STORE_ADDRESS: z.string().default("Sydney, Australia"),
  STORE_TIMEZONE: z.string().default("Australia/Sydney"),
  STORE_CURRENCY: z.string().default("AUD"),
  SHOWCASE_MODE: z.string().optional(),
  DEMO_MODE: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  STAFF_EMAILS: z.string().default("owner@example.com"),
  SQUARE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  SQUARE_ACCESS_TOKEN: z.string().optional(),
  SQUARE_LOCATION_ID: z.string().optional(),
  SQUARE_APPLICATION_ID: z.string().optional(),
  SQUARE_WEBHOOK_SIGNATURE_KEY: z.string().optional(),
  SQUARE_API_VERSION: z.string().default("2026-09-16"),
  SQUARE_CATEGORY_BOX_ID: z.string().optional(),
  SQUARE_CATEGORY_PROTEIN_ID: z.string().optional(),
  SQUARE_CATEGORY_VEGETABLE_ID: z.string().optional(),
  SQUARE_CATEGORY_STARCH_ID: z.string().optional(),
  SQUARE_CATEGORY_SAUCE_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Gemeshi Bento Lab <orders@example.com>"),
  CRON_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);

export const isSquareConfigured = Boolean(
  env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID && env.SQUARE_APPLICATION_ID
);

export const isShowcaseMode = env.SHOWCASE_MODE === "true";

export const isDemoMode =
  isShowcaseMode ||
  env.DEMO_MODE === "true" ||
  (env.DEMO_MODE !== "false" &&
    process.env.NODE_ENV !== "production" &&
    !isSquareConfigured);

export const staffEmails = new Set(
  env.STAFF_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export const squareConfig = {
  environment: env.SQUARE_ENV,
  accessToken: env.SQUARE_ACCESS_TOKEN ?? "",
  locationId: env.SQUARE_LOCATION_ID ?? "",
  applicationId: env.SQUARE_APPLICATION_ID ?? "",
  webhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "",
  apiVersion: env.SQUARE_API_VERSION,
  baseUrl:
    env.SQUARE_ENV === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com",
  categories: {
    box: env.SQUARE_CATEGORY_BOX_ID ?? "",
    protein: env.SQUARE_CATEGORY_PROTEIN_ID ?? "",
    vegetable: env.SQUARE_CATEGORY_VEGETABLE_ID ?? "",
    starch: env.SQUARE_CATEGORY_STARCH_ID ?? "",
    sauce: env.SQUARE_CATEGORY_SAUCE_ID ?? ""
  }
} as const;

export const publicConfig: PublicConfig = {
  demoMode: isDemoMode,
  showcaseMode: isShowcaseMode,
  checkoutEnabled: !isShowcaseMode,
  squareApplicationId: isSquareConfigured ? (env.SQUARE_APPLICATION_ID ?? null) : null,
  squareLocationId: isSquareConfigured ? (env.SQUARE_LOCATION_ID ?? null) : null,
  squareEnvironment: env.SQUARE_ENV,
  currency: env.STORE_CURRENCY,
  storeName: env.STORE_NAME,
  storeAddress: env.STORE_ADDRESS,
  timezone: env.STORE_TIMEZONE,
  appUrl: env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
} as const;

export function getAppUrl(requestUrl?: string): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Fall through to the development default or the production error below.
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }
  return "http://localhost:3000";
}

export function getMissingProductionConfig(): string[] {
  if (process.env.NODE_ENV !== "production") return [];

  const missing: string[] = [];
  if (!env.NEXT_PUBLIC_APP_URL) {
    missing.push("NEXT_PUBLIC_APP_URL");
  } else {
    const url = new URL(env.NEXT_PUBLIC_APP_URL);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
      missing.push("NEXT_PUBLIC_APP_URL (must be an HTTPS origin without a path)");
    }
  }
  if (isShowcaseMode) return missing;

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    missing.push("AUTH_SECRET (32+ characters)");
  }
  if (env.DEMO_MODE === "true") missing.push("DEMO_MODE must not be true in production");
  if (staffEmails.size === 0 || staffEmails.has("owner@example.com")) {
    missing.push("STAFF_EMAILS (replace the example allowlist)");
  }
  if (!isSquareConfigured) {
    missing.push("SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APPLICATION_ID");
  }
  if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY) missing.push("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (env.EMAIL_FROM.toLowerCase().includes("example.com")) {
    missing.push("EMAIL_FROM (replace the example sender)");
  }
  if (!env.CRON_SECRET) missing.push("CRON_SECRET");
  return missing;
}

export function assertProductionConfig(): void {
  const missing = getMissingProductionConfig();
  if (missing.length > 0) {
    throw new Error(`Invalid production configuration: ${missing.join("; ")}`);
  }
}
