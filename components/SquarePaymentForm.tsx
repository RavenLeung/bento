"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import type { PublicConfig } from "@/lib/types";

export interface PaymentContext {
  quoteToken: string;
  paymentAttemptKey: string;
}

interface SquareCard {
  attach(selector: string): Promise<void>;
  addEventListener?(event: string, handler: () => void): void;
  tokenize(): Promise<{
    status?: string;
    token?: string;
    errors?: Array<{ message?: string }>;
  }>;
  destroy(): Promise<void>;
}

interface SquarePayments {
  payments(appId: string, locationId: string): {
    card(): SquareCard;
  };
}

declare global {
  interface Window {
    Square?: SquarePayments;
  }
}

interface SquarePaymentFormProps {
  config: PublicConfig;
  amountCents: number;
  disabled: boolean;
  beforePay: () => Promise<PaymentContext>;
  onPay: (paymentToken: string, context: PaymentContext) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}

export function SquarePaymentForm({
  config,
  amountCents,
  disabled,
  beforePay,
  onPay,
  onBusyChange
}: SquarePaymentFormProps) {
  const [cardState, setCardState] = useState<"idle" | "loading" | "ready" | "error">(
    config.demoMode ? "ready" : "loading"
  );
  const [cardError, setCardError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cardRef = useRef<SquareCard | null>(null);
  const tokenRef = useRef<{ paymentAttemptKey: string; token: string } | null>(null);

  useEffect(() => {
    if (config.demoMode) return;
    if (!config.squareApplicationId || !config.squareLocationId) {
      setCardState("error");
      setCardError("Square payment details are not configured.");
      return;
    }

    let cancelled = false;
    let card: SquareCard | null = null;
    setCardState("loading");
    setCardError(null);

    loadSquareScript(config.squareEnvironment)
      .then(() => {
        if (cancelled) return;
        if (!window.Square) throw new Error("Square SDK loaded but was unavailable.");
        const payments = window.Square.payments(
          config.squareApplicationId!,
          config.squareLocationId!
        );
        card = payments.card();
        return card.attach("#square-card-container");
      })
      .then(() => {
        if (cancelled || !card) return;
        card.addEventListener?.("change", () => {
          tokenRef.current = null;
        });
        cardRef.current = card;
        setCardState("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setCardState("error");
        setCardError(reason instanceof Error ? reason.message : "Card form could not load.");
      });

    return () => {
      cancelled = true;
      cardRef.current = null;
      tokenRef.current = null;
      if (card) void card.destroy().catch(() => undefined);
    };
  }, [attempt, config.demoMode, config.squareApplicationId, config.squareEnvironment, config.squareLocationId]);

  async function handlePay() {
    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      const context = await beforePay();
      let token = "demo";
      if (!config.demoMode) {
        if (!cardRef.current) throw new Error("The card form is still loading. Try again in a moment.");
        if (tokenRef.current?.paymentAttemptKey === context.paymentAttemptKey) {
          token = tokenRef.current.token;
        } else {
          const result = await cardRef.current.tokenize();
          if (result.status !== "OK" || !result.token) {
            const message = result.errors?.map((entry) => entry.message).filter(Boolean).join(" ");
            throw new Error(message || "Check your card details and try again.");
          }
          token = result.token;
          tokenRef.current = { paymentAttemptKey: context.paymentAttemptKey, token };
        }
      }
      await onPay(token, context);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const blocked = disabled || busy || (!config.demoMode && cardState !== "ready");

  return (
    <div>
      {config.demoMode ? (
        <div className="rounded-2xl border border-dashed border-leaf/30 bg-leaf/5 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf/10 text-lg">🧪</span>
            <div>
              <p className="text-sm font-extrabold text-moss">Demo checkout</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">
                No card will be charged. This creates a paid demo order and sends it straight to the demo kitchen screen.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink/55">Card details</p>
            <span className="flex items-center gap-1 text-[10px] font-bold text-ink/35">
              <span aria-hidden="true">🔒</span> Secured by Square
            </span>
          </div>
          {cardState === "loading" ? (
            <div className="grid h-[58px] place-items-center rounded-2xl border border-ink/10 bg-paper text-xs font-semibold text-ink/40">
              Loading secure card form…
            </div>
          ) : null}
          {cardState === "error" ? (
            <div className="rounded-2xl border border-chili/20 bg-chili/5 p-3 text-xs text-chili">
              <p>{cardError ?? "Card form unavailable."}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="mt-2 font-bold underline underline-offset-2"
              >
                Try loading again
              </button>
            </div>
          ) : null}
          <div
            id="square-card-container"
            className={cn(
              "min-h-[58px] rounded-2xl border border-ink/10 bg-paper p-1.5",
              cardState !== "ready" && "hidden",
              busy && "pointer-events-none opacity-60"
            )}
          />
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-xl bg-chili/10 px-3 py-2.5 text-xs font-semibold leading-relaxed text-chili" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handlePay}
        disabled={blocked}
        data-testid="pay-button"
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black shadow-lg transition",
          blocked
            ? "cursor-not-allowed bg-ink/12 text-ink/35 shadow-none"
            : "bg-moss text-white hover:-translate-y-0.5 hover:bg-nori hover:shadow-xl active:translate-y-0"
        )}
      >
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Processing…
          </>
        ) : (
          <>Pay {formatMoney(amountCents, config.currency)}</>
        )}
      </button>
      <p className="mt-2 text-center text-[10px] leading-relaxed text-ink/35">
        Final total is checked against Square before payment. GST included.
      </p>
    </div>
  );
}

let scriptPromise: Promise<void> | null = null;
let loadedEnvironment: "sandbox" | "production" | null = null;

function loadSquareScript(environment: "sandbox" | "production"): Promise<void> {
  if (loadedEnvironment === environment) return scriptPromise ?? Promise.resolve();
  if (scriptPromise && loadedEnvironment === environment) return scriptPromise;

  loadedEnvironment = environment;
  const request = new Promise<void>((resolve, reject) => {
    const id = "square-web-payments-sdk";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.remove();
    }
    const script = document.createElement("script");
    script.id = id;
    script.src =
      environment === "production"
        ? "https://web.squarecdn.com/v1/square.js"
        : "https://sandbox.web.squarecdn.com/v1/square.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Square SDK failed to load. Check your connection and retry."));
    };
    document.head.appendChild(script);
  });
  scriptPromise = request;
  request.catch(() => {
    if (scriptPromise === request) {
      scriptPromise = null;
      loadedEnvironment = null;
    }
  });
  return request;
}
