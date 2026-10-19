import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env, isDemoMode, staffEmails } from "@/lib/config";
import { sqlClient } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { staffOtpEmail } from "@/lib/email/templates";
import { signStaffSession, verifyStaffSession } from "@/lib/signing";

const COOKIE_NAME = "bento_staff";
const OTP_TTL_MS = 10 * 60_000;
const secret = env.AUTH_SECRET || "bento-lab-development-secret-change-me";

function hashOtp(email: string, code: string): string {
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAllowedStaff(email: string): boolean {
  return staffEmails.has(email.trim().toLowerCase());
}

export async function requestStaffOtp(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!isAllowedStaff(email)) {
    throw new Error("This email is not on the staff allowlist.");
  }
  const code = String(randomInt(100000, 999999));
  if (sqlClient) {
    await sqlClient`
      insert into staff_otps (id, email, code_hash, expires_at, created_at)
      values (${randomUUID()}, ${email}, ${hashOtp(email, code)}, now() + interval '10 minutes', now())
    `;
  } else if (!isDemoMode) {
    throw new Error("Database is not configured.");
  }
  const template = staffOtpEmail(code);
  await sendEmail({ to: email, ...template });
  if (isDemoMode) {
    console.info(`[demo staff otp] ${email} → ${code}`);
  }
}

export async function verifyStaffOtp(rawEmail: string, code: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!isAllowedStaff(email)) return false;
  if (isDemoMode && !sqlClient) return code === "123456" || code.length === 6;
  if (!sqlClient) return false;
  const [row] = await sqlClient<Array<{ id: string; code_hash: string }>>`
    select id, code_hash, expires_at
    from staff_otps
    where email = ${email} and consumed_at is null and expires_at > now()
    order by created_at desc limit 1
  `;
  if (!row) return false;
  if (!sameHash(String(row.code_hash), hashOtp(email, code))) return false;
  await sqlClient`update staff_otps set consumed_at = now() where id = ${row.id}`;
  return true;
}

export async function setStaffSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signStaffSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearStaffSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getStaffSession(): Promise<{ email: string } | null> {
  if (isDemoMode) return { email: "demo@bento.local" };
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifyStaffSession(token);
  if (!session || !isAllowedStaff(session.email)) return null;
  return session;
}

export async function requireStaff(): Promise<{ email: string }> {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  return session;
}
