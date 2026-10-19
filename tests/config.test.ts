import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RELEVANT_ENV = [
  "NODE_ENV",
  "SHOWCASE_MODE",
  "DEMO_MODE",
  "NEXT_PUBLIC_APP_URL",
  "STORE_NAME",
  "STORE_ADDRESS",
  "STORE_TIMEZONE",
  "STORE_CURRENCY",
  "DATABASE_URL",
  "AUTH_SECRET",
  "STAFF_EMAILS",
  "SQUARE_ENV",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "SQUARE_APPLICATION_ID",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_API_VERSION",
  "SQUARE_CATEGORY_BOX_ID",
  "SQUARE_CATEGORY_PROTEIN_ID",
  "SQUARE_CATEGORY_VEGETABLE_ID",
  "SQUARE_CATEGORY_STARCH_ID",
  "SQUARE_CATEGORY_SAUCE_ID",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET"
] as const;

let originalEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else Object.assign(process.env, { [key]: value });
}

beforeEach(() => {
  originalEnv = Object.fromEntries(RELEVANT_ENV.map((key) => [key, process.env[key]]));
  for (const key of RELEVANT_ENV) delete process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of RELEVANT_ENV) {
    setEnv(key, originalEnv[key]);
  }
  vi.resetModules();
});

describe("runtime configuration", () => {
  it("enables demo mode by default outside production", async () => {
    setEnv("NODE_ENV", "test");
    const { isDemoMode } = await import("@/lib/config");
    expect(isDemoMode).toBe(true);
  });

  it("does not enable demo mode by default in production", async () => {
    setEnv("NODE_ENV", "production");
    const { isDemoMode } = await import("@/lib/config");
    expect(isDemoMode).toBe(false);
  });

  it("reports missing production configuration", async () => {
    setEnv("NODE_ENV", "production");
    const { getMissingProductionConfig } = await import("@/lib/config");

    expect(getMissingProductionConfig()).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_APP_URL",
        "DATABASE_URL",
        "AUTH_SECRET (32+ characters)",
        "SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APPLICATION_ID",
        "SQUARE_WEBHOOK_SIGNATURE_KEY",
        "RESEND_API_KEY",
        "CRON_SECRET"
      ])
    );
  });

  it("accepts a public showcase with only an HTTPS app URL", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("SHOWCASE_MODE", "true");
    setEnv("NEXT_PUBLIC_APP_URL", "https://gemeshi-bento-lab.vercel.app");
    const { getMissingProductionConfig, isDemoMode, isShowcaseMode, publicConfig } =
      await import("@/lib/config");

    expect(isShowcaseMode).toBe(true);
    expect(isDemoMode).toBe(true);
    expect(publicConfig.showcaseMode).toBe(true);
    expect(publicConfig.checkoutEnabled).toBe(false);
    expect(getMissingProductionConfig()).toEqual([]);
  });

  it("still requires a clean HTTPS app URL in showcase mode", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("SHOWCASE_MODE", "true");
    setEnv("NEXT_PUBLIC_APP_URL", "http://gemeshi-bento-lab.vercel.app/path");
    const { getMissingProductionConfig } = await import("@/lib/config");

    expect(getMissingProductionConfig()).toEqual([
      "NEXT_PUBLIC_APP_URL (must be an HTTPS origin without a path)"
    ]);
  });

  it("falls back to the request origin when the app URL is absent", async () => {
    setEnv("NODE_ENV", "production");
    const { getAppUrl } = await import("@/lib/config");

    expect(getAppUrl("https://shop.example.com/api/square/webhooks?x=1")).toBe(
      "https://shop.example.com"
    );
    expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
