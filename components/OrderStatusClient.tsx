"use client";

import { useEffect, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import type { OrderStatus, PublicConfig, PublicOrder } from "@/lib/types";

const TERMINAL_STATUSES: OrderStatus[] = ["PICKED_UP", "CANCELED", "REFUNDED", "FAILED"];

const STATUS_COPY: Record<
  OrderStatus,
  { eyebrow: string; title: string; body: string; tone: string }
> = {
  PENDING_PAYMENT: {
    eyebrow: "Payment",
    title: "Finishing your order…",
    body: "This page will update as soon as payment is confirmed.",
    tone: "bg-yuzu/20 text-ink"
  },
  PAID: {
    eyebrow: "In the kitchen",
    title: "We are on it.",
    body: "Your box is being packed now. We will update this page and email you the moment it is ready.",
    tone: "bg-yuzu/20 text-ink"
  },
  READY: {
    eyebrow: "Ready",
    title: "Your bento is ready.",
    body: "Come on up to the counter and show your pickup code. We will keep it waiting for you.",
    tone: "bg-yuzu text-ink"
  },
  PICKED_UP: {
    eyebrow: "Collected",
    title: "Lunch secured.",
    body: "Thanks for building a bento with us. We hope every slot hits the spot.",
    tone: "bg-leaf/10 text-moss"
  },
  CANCELED: {
    eyebrow: "Canceled",
    title: "This order was canceled.",
    body: "No bento is being prepared for this order. Please speak with the team if you need a hand.",
    tone: "bg-ink/5 text-ink/60"
  },
  REFUNDED: {
    eyebrow: "Refunded",
    title: "This order was refunded.",
    body: "The refund has been recorded. Your bank may take a few business days to show it.",
    tone: "bg-ink/5 text-ink/60"
  },
  FAILED: {
    eyebrow: "Not completed",
    title: "The payment did not go through.",
    body: "This payment attempt did not complete. Please check with the team before paying again.",
    tone: "bg-chili/10 text-chili"
  }
};

export function OrderStatusClient({
  token,
  initialOrder,
  config,
  showConfirmation
}: {
  token: string;
  initialOrder: PublicOrder;
  config: PublicConfig;
  showConfirmation: boolean;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    if (TERMINAL_STATUSES.includes(order.status)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to refresh this order.");
        const next = (await response.json()) as PublicOrder;
        if (!cancelled) {
          setOrder(next);
          setRefreshError(null);
          setLastChecked(new Date());
        }
      } catch {
        if (!cancelled) setRefreshError("Live updates paused. We will keep trying.");
      }
    };

    const timer = window.setInterval(refresh, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [order.status, token]);

  useEffect(() => {
    document.title = `Order ${order.orderCode} · ${config.storeName}`;
  }, [config.storeName, order.orderCode]);

  const copy = STATUS_COPY[order.status];
  const step = stepForStatus(order.status);
  const terminal = TERMINAL_STATUSES.includes(order.status);
  const showPickupCode = ["PAID", "READY", "PICKED_UP"].includes(order.status);

  return (
    <div className="relative min-h-dvh overflow-x-clip pb-12">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Bento Lab home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-yuzu text-xl shadow-sm ring-1 ring-ink/10">🍱</span>
          <span>
            <span className="block font-display text-lg font-black leading-none tracking-tight">Bento Lab</span>
            <span className="block text-[9px] font-black uppercase tracking-[0.19em] text-leaf">Order tracker</span>
          </span>
        </a>
        <a href="/" className="rounded-full bg-paper px-3.5 py-2 text-xs font-extrabold text-moss shadow-sm ring-1 ring-ink/5">
          Build another
        </a>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        {showConfirmation && showPickupCode ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-leaf/15 bg-leaf/10 px-4 py-3 text-sm font-bold text-moss" role="status">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/70 text-xs">✓</span>
            Payment confirmed. Your order is with the kitchen.
          </div>
        ) : null}

        <section className={cn("overflow-hidden rounded-[2rem] border border-ink/8 p-5 shadow-soft sm:p-7", copy.tone)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-55">{copy.eyebrow}</p>
              <h1 className="mt-1.5 font-display text-[clamp(2.3rem,8vw,4.2rem)] font-black leading-[0.95] tracking-[-0.045em]" data-testid="order-status">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-md text-sm font-medium leading-relaxed opacity-65">{copy.body}</p>
            </div>
            <div className={cn("relative grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] bg-white/55 text-4xl sm:h-20 sm:w-20 sm:text-5xl", order.status === "READY" && "animate-float")} aria-hidden="true">
              {order.status === "READY" ? "🍱" : order.status === "PICKED_UP" ? "🥢" : order.status === "FAILED" ? "💳" : "👩‍🍳"}
              {order.status === "READY" ? (
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-chili" />
              ) : null}
            </div>
          </div>

          {showPickupCode ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl bg-white/65 p-4 ring-1 ring-black/5">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">Pickup code</p>
                <p className="mt-1 font-display text-4xl font-black tracking-[0.09em]" data-testid="pickup-code">
                  {order.orderCode}
                </p>
                <p className="mt-1 text-[10px] font-semibold opacity-45">Show this at the counter</p>
              </div>
              <div className="rounded-2xl bg-white/45 p-4 ring-1 ring-black/5">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">Pickup</p>
                <p className="mt-1 text-sm font-black leading-snug">{formatPickup(order.pickupAt, config.timezone)}</p>
                <p className="mt-1 text-[10px] leading-relaxed opacity-45">{config.storeAddress}</p>
              </div>
            </div>
          ) : null}
        </section>

        {!terminal && order.status !== "FAILED" ? (
          <section className="mt-4 rounded-[1.6rem] border border-ink/8 bg-paper p-4 shadow-sm sm:p-5" aria-label="Order progress">
            <div className="grid grid-cols-4 gap-1">
              {["Confirmed", "Cooking", "Ready", "Picked up"].map((label, index) => {
                const complete = index <= step;
                const current = index === step;
                return (
                  <div key={label} className="relative text-center">
                    {index > 0 ? (
                      <div className={cn("absolute left-[-50%] right-1/2 top-3.5 h-0.5 -translate-y-1/2", index <= step ? "bg-leaf" : "bg-ink/10")} />
                    ) : null}
                    <div
                      className={cn(
                        "relative z-10 mx-auto grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black transition",
                        complete ? "border-leaf bg-leaf text-white" : "border-ink/10 bg-paper text-ink/25",
                        current && order.status === "READY" && "ring-4 ring-yuzu/50"
                      )}
                    >
                      {index < step ? "✓" : index + 1}
                    </div>
                    <p className={cn("mt-1.5 text-[9px] font-bold", complete ? "text-moss" : "text-ink/30")}>{label}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold text-ink/35" aria-live="polite">
              {refreshError
                ? refreshError
                : lastChecked
                  ? `Live · checked ${lastChecked.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`
                  : "This page updates automatically."}
            </p>
          </section>
        ) : null}

        <section className="mt-4 rounded-[1.6rem] border border-ink/8 bg-paper p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-leaf">Order {order.orderCode}</p>
              <h2 className="mt-0.5 font-display text-xl font-black">{order.boxName}</h2>
            </div>
            <p className="font-display text-2xl font-black">{formatMoney(order.totalCents, order.currency)}</p>
          </div>
          <div className="mt-3 divide-y divide-ink/6">
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", line.section === "protein" ? "bg-salmon" : line.section === "vegetable" ? "bg-leaf" : "bg-yuzu")} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink/70">{line.name}</span>
                <span className="text-xs font-black tabular-nums text-ink/45">×{line.quantity}</span>
                <span className="w-16 text-right text-xs font-bold tabular-nums text-ink/55">{formatMoney(line.lineTotalCents, order.currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-ink/10 pt-3">
            <span className="text-[10px] font-bold text-ink/40">GST included · Pickup only</span>
            <span className="text-sm font-black">{formatMoney(order.totalCents, order.currency)}</span>
          </div>
        </section>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a href="/" className="rounded-2xl bg-moss px-5 py-3.5 text-center text-sm font-black text-white shadow-sm transition hover:bg-nori">
            Build another bento
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`Bento order ${order.orderCode}`)}&body=${encodeURIComponent(`Order ${order.orderCode} for ${formatPickup(order.pickupAt, config.timezone)}`)}`} className="rounded-2xl border border-ink/10 bg-paper px-5 py-3.5 text-center text-sm font-black text-ink/60 transition hover:border-leaf/30 hover:text-ink">
            Share order details
          </a>
        </div>
        <p className="mt-5 text-center text-[9px] leading-relaxed text-ink/30">
          Need a hand? Speak with the team at {config.storeAddress}. Keep this link private — it is your order key.
        </p>
      </main>
    </div>
  );
}

function stepForStatus(status: OrderStatus): number {
  if (status === "PICKED_UP") return 3;
  if (status === "READY") return 2;
  if (status === "PAID") return 1;
  return 0;
}

function formatPickup(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}
