import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config";
import { AppError, type QuoteDraft } from "@/lib/types";

const secret = env.AUTH_SECRET || "bento-lab-development-secret-change-me";

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function hmac(value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function signValue<T>(payload: T): string {
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

export function verifyValue<T>(token: string): T {
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, hmac(body))) {
    throw new AppError("BAD_REQUEST", "Invalid signed payload.", 400);
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid signed payload.", 400);
  }
}

interface SignedQuote {
  version: 1;
  expiresAt: string;
  data: QuoteDraft;
}

export function signQuote(quote: QuoteDraft, ttlSeconds = 300): { quoteToken: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const token = signValue<SignedQuote>({
    version: 1,
    expiresAt,
    data: quote
  });
  return { quoteToken: token, expiresAt };
}

export function verifyQuoteToken(token: string): QuoteDraft {
  const payload = verifyValue<SignedQuote>(token);
  if (payload.version !== 1 || !payload.data) {
    throw new AppError("BAD_REQUEST", "Invalid quote.");
  }
  if (Date.now() > new Date(payload.expiresAt).getTime()) {
    throw new AppError("QUOTE_EXPIRED", "Your quote expired. Review your bento and try again.", 409);
  }
  return payload.data;
}

export function signStaffSession(email: string, ttlSeconds = 60 * 60 * 12): string {
  return signValue({
    kind: "staff",
    email: email.toLowerCase(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
  });
}

export function verifyStaffSession(token: string): { email: string } | null {
  try {
    const payload = verifyValue<{ kind?: string; email?: string; expiresAt?: string }>(token);
    if (payload.kind !== "staff" || !payload.email || !payload.expiresAt) return null;
    if (Date.now() > new Date(payload.expiresAt).getTime()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
