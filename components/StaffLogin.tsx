"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function StaffLogin({ storeName }: { storeName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send a code.");
      setStep("code");
      setMessage("Code sent. It expires in 10 minutes.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That code did not work.");
      router.replace("/staff");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <a href="/" className="mx-auto flex w-fit items-center gap-2.5" aria-label="Back to Gemeshi Bento Lab">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-yuzu text-2xl shadow-sm ring-1 ring-ink/10">🍱</span>
          <span>
            <span className="block font-display text-xl font-black leading-none tracking-tight">{storeName}</span>
            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-leaf">Staff kitchen</span>
          </span>
        </a>

        <section className="mt-6 rounded-[2rem] border border-ink/8 bg-paper p-6 shadow-soft">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-leaf">
            {step === "email" ? "Staff access" : "One-time code"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
            {step === "email" ? "Clock in." : "Check your inbox."}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-ink/50">
            {step === "email"
              ? "Use your allowlisted work email. We will send a six-digit sign-in code."
              : `Enter the code sent to ${email}.`}
          </p>

          {step === "email" ? (
            <form onSubmit={requestCode} className="mt-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-ink/55">Work email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-ink/12 bg-white px-3.5 py-3 text-sm font-semibold outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
                  placeholder="you@example.com"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-moss px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-nori disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send sign-in code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-ink/55">Six-digit code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-ink/12 bg-white px-3.5 py-3 text-center font-display text-2xl font-black tracking-[0.25em] outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/15"
                  placeholder="000000"
                />
              </label>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="mt-4 w-full rounded-xl bg-moss px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-nori disabled:opacity-50"
              >
                {busy ? "Checking…" : "Open kitchen screen"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setMessage(null);
                }}
                className="mt-3 w-full py-2 text-xs font-bold text-ink/40 hover:text-ink"
              >
                Use a different email
              </button>
            </form>
          )}

          {message ? <p className="mt-3 text-center text-xs font-semibold text-leaf">{message}</p> : null}
          {error ? (
            <p className="mt-3 rounded-xl bg-chili/10 px-3 py-2.5 text-xs font-semibold text-chili" role="alert">
              {error}
            </p>
          ) : null}
        </section>
        <p className="mt-4 text-center text-[10px] font-semibold text-ink/30">
          Staff access is limited to the configured allowlist.
        </p>
      </div>
    </main>
  );
}
