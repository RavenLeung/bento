import { Resend } from "resend";
import { env } from "@/lib/config";

let client: Resend | null = null;

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.info(`[email:dev] ${input.subject} → ${input.to}`);
    return;
  }
  client ??= new Resend(env.RESEND_API_KEY);
  const result = await client.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html
  });
  if (result.error) {
    throw new Error(`Resend email failed: ${result.error.message}`);
  }
}
