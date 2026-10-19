"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SquarePaymentForm, type PaymentContext } from "@/components/SquarePaymentForm";
import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem, PickupSlot, PublicConfig, Quote } from "@/lib/types";

interface AvailabilityResponse {
  slots: PickupSlot[];
  timezone: string;
  acceptingOrders: boolean;
}

export interface SummaryLine {
  itemId: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
}

interface CheckoutPanelProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (orderToken: string) => void;
  config: PublicConfig;
  box: CatalogItem;
  selections: Array<{ itemId: string; quantity: number }>;
  summaryLines: SummaryLine[];
  totalCents: number;
}

type TouchedFields = {
  name: boolean;
  email: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CheckoutPanel({
  open,
  onClose,
  onSuccess,
  config,
  box,
  selections,
  summaryLines,
  totalCents
}: CheckoutPanelProps) {
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [refreshingSlots, setRefreshingSlots] = useState(false);
  const [slotRefreshError, setSlotRefreshError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);
  const [touched, setTouched] = useState<TouchedFields>({ name: false, email: false });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(createUuid());
  const paymentAttemptKey = useRef(createUuid());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const selectionKey = useMemo(
    () => selections.map((selection) => `${selection.itemId}:${selection.quantity}`).join("|"),
    [selections]
  );
  const trimmedName = customerName.trim();
  const trimmedEmail = customerEmail.trim();
  const nameValid = trimmedName.length >= 2;
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const detailsComplete = nameValid && emailValid && allergenAcknowledged;
  const quoteTotalCents = quote?.totalCents ?? totalCents;
  const priceChanged = Boolean(quote && quote.totalCents !== totalCents);
  const selectedPickup = availability?.slots.find((slot) => slot.at === selectedSlot) ?? null;
  const currentStep = !selectedSlot ? 1 : !detailsComplete ? 2 : 3;
  const nameError = touched.name && !nameValid;
  const emailError = touched.email && !emailValid;
  const displayedLines = quote?.lines ?? summaryLines;
  let missingDetail: string | null = null;
  if (slotsLoading) missingDetail = "Checking today's pickup times…";
  else if (loadError && !availability) missingDetail = null;
  else if (availability && !availability.acceptingOrders) {
    missingDetail = "The kitchen has paused new orders. Payment is unavailable right now.";
  } else if (!selectedSlot) missingDetail = "Choose a pickup time to continue.";
  else if (!nameValid) missingDetail = "Add the name for the order.";
  else if (!emailValid) missingDetail = "Add a valid email for the receipt and pickup alert.";
  else if (!allergenAcknowledged) missingDetail = "Acknowledge the allergen notice to unlock payment.";
  else if (priceChanged) {
    missingDetail = `The menu total is now ${formatMoney(quoteTotalCents, config.currency)}. Close checkout and review your bento.`;
  }

  useEffect(() => {
    idempotencyKey.current = createUuid();
    paymentAttemptKey.current = createUuid();
  }, [box.id, selectionKey]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus({ preventScroll: true });
      previouslyFocused.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!submitting) onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open, submitting]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSlotsLoading(true);
    setLoadError(null);
    setSlotRefreshError(null);
    setQuote(null);

    Promise.all([fetchAvailability(), requestQuote(box.id, selections)])
      .then(([nextAvailability, nextQuote]) => {
        if (cancelled) return;
        setAvailability(nextAvailability);
        const firstOpen = nextAvailability.slots.find((slot) => slot.remaining > 0);
        setSelectedSlot((current) =>
          current && nextAvailability.slots.some((slot) => slot.at === current && slot.remaining > 0)
            ? current
            : (firstOpen?.at ?? "")
        );
        setQuote(nextQuote);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(reason instanceof Error ? reason.message : "Unable to prepare checkout.");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [box.id, loadAttempt, open, selectionKey]);

  function requestClose() {
    if (!submitting) onClose();
  }

  async function refreshSlots() {
    if (refreshingSlots) return;
    setRefreshingSlots(true);
    setSlotRefreshError(null);
    try {
      const next = await fetchAvailability();
      setAvailability(next);
      setSelectedSlot((current) =>
        next.slots.some((slot) => slot.at === current && slot.remaining > 0)
          ? current
          : (next.slots.find((slot) => slot.remaining > 0)?.at ?? "")
      );
    } catch (reason) {
      setSlotRefreshError(
        reason instanceof Error ? reason.message : "Unable to refresh pickup times. Please try again."
      );
    } finally {
      setRefreshingSlots(false);
    }
  }

  async function beforePay(): Promise<PaymentContext> {
    setTouched({ name: true, email: true });
    if (!selectedSlot) throw new Error("Choose a pickup time.");
    if (!nameValid) throw new Error("Enter the name for the order.");
    if (!emailValid) throw new Error("Enter a valid email address for your confirmation.");
    if (!allergenAcknowledged) throw new Error("Please acknowledge the allergen notice.");
    if (priceChanged) throw new Error("The menu price changed. Please close checkout and review your bento.");

    const freshQuote = await requestQuote(box.id, selections);
    setQuote(freshQuote);
    if (freshQuote.totalCents !== totalCents) {
      throw new Error("The menu price changed while you were ordering. Please close this panel and review your bento.");
    }
    return {
      quoteToken: freshQuote.quoteToken,
      paymentAttemptKey: paymentAttemptKey.current
    };
  }

  async function handlePay(paymentToken: string, context: PaymentContext) {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteToken: context.quoteToken,
        paymentToken,
        paymentAttemptKey: context.paymentAttemptKey,
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        pickupAt: selectedSlot,
        allergenAcknowledged: true,
        idempotencyKey: idempotencyKey.current
      })
    });
    const data = (await response.json().catch(() => ({}))) as {
      orderToken?: string;
      error?: string;
      code?: string;
    };
    if (!response.ok || !data.orderToken) {
      if (data.code && data.code !== "PAYMENT_UNCERTAIN") {
        idempotencyKey.current = createUuid();
        paymentAttemptKey.current = createUuid();
      }
      if (data.code === "SLOT_UNAVAILABLE") void refreshSlots();
      if (data.code === "PRICE_CHANGED" || data.code === "QUOTE_EXPIRED") {
        setLoadAttempt((value) => value + 1);
      }
      throw new Error(data.error || "Payment could not be completed. Please try again.");
    }
    onSuccess(data.orderToken);
  }

  const basicDetailsValid =
    Boolean(selectedSlot) &&
    nameValid &&
    emailValid &&
    allergenAcknowledged &&
    Boolean(quote) &&
    !priceChanged &&
    Boolean(availability?.acceptingOrders);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={requestClose}
        disabled={submitting}
        className="absolute inset-0 animate-fade-in bg-nori/55 backdrop-blur-[3px] disabled:cursor-wait"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        aria-busy={submitting}
        className="absolute inset-x-0 bottom-0 max-h-[94dvh] animate-checkout-panel overflow-y-auto rounded-t-[2rem] bg-rice shadow-lift sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[90dvh] sm:w-[min(92vw,42rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]"
      >
        <div className="sticky top-0 z-10 border-b border-ink/8 bg-rice/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-leaf">Checkout</p>
                <span className="h-1 w-1 rounded-full bg-ink/20" />
                <p className="text-[10px] font-bold text-ink/40">Step {currentStep} of 3</p>
              </div>
              <h2 id="checkout-title" className="font-display text-xl font-black tracking-tight">
                Almost lunch
              </h2>
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-bold text-ink/55 shadow-sm ring-1 ring-ink/8 transition hover:bg-ink/5 hover:text-ink disabled:cursor-wait disabled:opacity-40"
              aria-label="Close checkout"
            >
              ×
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1 rounded-full transition-colors",
                  step <= currentStep ? "bg-leaf" : "bg-ink/8"
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-7">
          <section className="rounded-2xl border border-ink/8 bg-paper p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/40">Your bento</p>
                <p className="mt-0.5 text-sm font-extrabold">{box.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-ink/40">Pickup only · {config.storeName}</p>
              </div>
              <p className="font-display text-2xl font-black tabular-nums">
                {formatMoney(quoteTotalCents, config.currency)}
              </p>
            </div>
            <div className="mt-3 divide-y divide-ink/6 rounded-xl bg-rice/70 px-3">
              {displayedLines.map((line) => (
                <div key={line.itemId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink/65">{line.name}</span>
                  <span className="text-[10px] font-black tabular-nums text-ink/40">×{line.quantity}</span>
                  <span className="w-14 text-right text-[10px] font-bold tabular-nums text-ink/50">
                    {formatMoney(line.lineTotalCents, config.currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold text-ink/35">GST included</span>
              <span className="text-xs font-black tabular-nums">
                {formatMoney(quoteTotalCents, config.currency)}
              </span>
            </div>
            {priceChanged ? (
              <div className="mt-3 rounded-xl border border-yuzu/50 bg-yuzu/20 p-3 text-[11px] font-bold leading-relaxed text-ink/65" role="alert">
                The menu price changed. Close checkout to review your bento before paying.
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={submitting}
                  className="ml-1 underline underline-offset-2 disabled:opacity-50"
                >
                  Review now
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-leaf">Step 1</p>
                <h3 className="mt-1 font-display text-lg font-black">Pickup time</h3>
              </div>
              <button
                type="button"
                onClick={() => void refreshSlots()}
                disabled={slotsLoading || refreshingSlots || submitting}
                className="pb-1 text-[10px] font-black uppercase tracking-wide text-moss underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-40"
              >
                {refreshingSlots ? "Refreshing…" : "Refresh times"}
              </button>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-ink/40">
              Today · {formatTimezone(config.timezone)} · same-day pickup only
            </p>

            {slotRefreshError ? (
              <p className="mt-3 rounded-xl bg-chili/10 px-3 py-2.5 text-[11px] font-semibold text-chili" role="alert">
                {slotRefreshError}
              </p>
            ) : null}

            {loadError ? (
              <div className="mt-3 rounded-xl bg-chili/10 p-3 text-xs font-semibold text-chili" role="alert">
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => setLoadAttempt((value) => value + 1)}
                  disabled={submitting}
                  className="mt-2 font-bold underline underline-offset-2 disabled:opacity-40"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {availability && !availability.acceptingOrders ? (
              <div className="mt-3 rounded-2xl border border-yuzu/40 bg-yuzu/15 p-4 text-sm font-semibold text-ink/65">
                The kitchen has paused new orders. Please check back shortly.
              </div>
            ) : null}

            {slotsLoading ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-ink/8" />
                ))}
              </div>
            ) : availability?.slots.some((slot) => slot.remaining > 0) ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Pickup times">
                {availability.slots.map((slot, index) => {
                  const full = slot.remaining <= 0;
                  const active = selectedSlot === slot.at;
                  return (
                    <button
                      key={slot.at}
                      type="button"
                      disabled={full || submitting}
                      aria-pressed={active}
                      data-testid={`slot-${index}`}
                      onClick={() => setSelectedSlot(slot.at)}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-center transition disabled:cursor-not-allowed",
                        active
                          ? "border-moss bg-moss text-white shadow-sm"
                          : "border-ink/10 bg-paper text-ink hover:border-leaf/40",
                        full && "cursor-not-allowed border-ink/5 bg-ink/[0.025] text-ink/25 line-through"
                      )}
                    >
                      <span className="block text-sm font-black">{slot.label}</span>
                      <span className={cn("block text-[9px] font-bold", active ? "text-white/60" : "text-ink/35")}>
                        {full ? "Full" : `${slot.remaining} left`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : availability ? (
              <div className="mt-3 rounded-2xl border border-ink/10 bg-paper p-4 text-sm text-ink/55">
                <p>No pickup slots remain today. The kitchen may be closed or fully booked.</p>
                <button
                  type="button"
                  onClick={() => void refreshSlots()}
                  disabled={refreshingSlots || submitting}
                  className="mt-2 text-xs font-extrabold text-moss underline underline-offset-2 disabled:opacity-40"
                >
                  Check again
                </button>
              </div>
            ) : null}

            {selectedPickup ? (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-leaf/8 px-3 py-2.5 text-[11px] font-bold text-moss">
                <span aria-hidden="true">📍</span>
                <span>
                  Pickup at {selectedPickup.label} · {config.storeAddress}
                </span>
              </div>
            ) : null}
          </section>

          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-leaf">Step 2</p>
            <h3 className="mt-1 font-display text-lg font-black">Who is it for?</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-ink/60">Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                  placeholder="Alex"
                  maxLength={80}
                  disabled={submitting}
                  aria-invalid={nameError}
                  aria-describedby="checkout-name-help"
                  className={cn(
                    "w-full rounded-xl border bg-paper px-3.5 py-3 text-sm font-semibold outline-none transition placeholder:text-ink/25 focus:ring-2 disabled:opacity-60",
                    nameError
                      ? "border-chili focus:border-chili focus:ring-chili/15"
                      : "border-ink/12 focus:border-leaf focus:ring-leaf/15"
                  )}
                />
                <span id="checkout-name-help" className={cn("mt-1 block text-[10px] font-semibold", nameError ? "text-chili" : "text-ink/35")}>
                  {nameError ? "Use at least 2 characters." : "The name we will call at the counter."}
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-ink/60">Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  placeholder="alex@example.com"
                  maxLength={180}
                  disabled={submitting}
                  aria-invalid={emailError}
                  aria-describedby="checkout-email-help"
                  className={cn(
                    "w-full rounded-xl border bg-paper px-3.5 py-3 text-sm font-semibold outline-none transition placeholder:text-ink/25 focus:ring-2 disabled:opacity-60",
                    emailError
                      ? "border-chili focus:border-chili focus:ring-chili/15"
                      : "border-ink/12 focus:border-leaf focus:ring-leaf/15"
                  )}
                />
                <span id="checkout-email-help" className={cn("mt-1 block text-[10px] font-semibold", emailError ? "text-chili" : "text-ink/35")}>
                  {emailError ? "Enter a valid email address." : "Receipt and ready-to-collect alert."}
                </span>
              </label>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink/38">
              We only use these details for your receipt, order updates and pickup alert.
            </p>
          </section>

          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-leaf">Step 3</p>
            <h3 className="mt-1 font-display text-lg font-black">Allergens & payment</h3>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-ink/10 bg-paper p-3.5 transition hover:border-ink/15">
              <input
                type="checkbox"
                checked={allergenAcknowledged}
                onChange={(event) => setAllergenAcknowledged(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 rounded border-ink/20"
              />
              <span className="text-[11px] font-medium leading-relaxed text-ink/60">
                I understand this kitchen handles fish, shellfish, egg, milk, soy, sesame, gluten and nuts, and cannot
                guarantee an allergen-free environment. I will ask staff if unsure.
              </span>
            </label>

            {missingDetail ? (
              <p className="mt-3 rounded-xl bg-ink/[0.035] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-ink/50" aria-live="polite">
                {missingDetail}
              </p>
            ) : null}

            <div className="mt-4">
              <SquarePaymentForm
                config={config}
                amountCents={quoteTotalCents}
                disabled={!basicDetailsValid || slotsLoading || submitting}
                beforePay={beforePay}
                onPay={handlePay}
                onBusyChange={setSubmitting}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function fetchAvailability(): Promise<AvailabilityResponse> {
  const response = await fetch("/api/availability", { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as AvailabilityResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || "Unable to load pickup times.");
  return data;
}

async function requestQuote(
  boxItemId: string,
  selections: Array<{ itemId: string; quantity: number }>
): Promise<Quote> {
  const response = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boxItemId, selections })
  });
  const data = (await response.json().catch(() => ({}))) as Quote & { error?: string };
  if (!response.ok) throw new Error(data.error || "Unable to review your bento.");
  return data;
}

function formatTimezone(timezone: string): string {
  return timezone.replaceAll("_", " ");
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
