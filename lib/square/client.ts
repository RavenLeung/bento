import { createHmac, timingSafeEqual } from "node:crypto";
import { squareConfig } from "@/lib/config";

export class SquareApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string
  ) {
    super(message || `Square API returned ${status}`);
    this.name = "SquareApiError";
  }
}

export async function squareFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!squareConfig.accessToken) {
    throw new SquareApiError(503, null, "Square access token is not configured.");
  }

  const response = await fetch(`${squareConfig.baseUrl}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${squareConfig.accessToken}`,
      "Square-Version": squareConfig.apiVersion,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new SquareApiError(response.status, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function verifySquareWebhookSignature(
  rawBody: string,
  signature: string | null,
  notificationUrl: string
): boolean {
  const key = squareConfig.webhookSignatureKey;
  if (!key) return false;
  if (!signature) return false;

  const expected = createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
