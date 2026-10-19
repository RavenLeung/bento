"use client";

import { useEffect, useMemo, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import type { OrderStatus, StaffOrderView, StoreSettings } from "@/lib/types";

type Tab = "active" | "upcoming" | "done" | "all";

const TAB_LABELS: Record<Tab, string> = {
  active: "Kitchen",
  upcoming: "Paying",
  done: "Collected",
  all: "All today"
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-ink/8 text-ink/45",
  PAID: "bg-chili/15 text-ink",
  READY: "bg-nori text-white",
  PICKED_UP: "bg-ink/8 text-ink/55",
  CANCELED: "bg-ink/8 text-ink/40",
  REFUNDED: "bg-ink/8 text-ink/40",
  FAILED: "bg-chili/10 text-chili"
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Paying",
  PAID: "Cooking",
  READY: "Ready",
  PICKED_UP: "Collected",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
  FAILED: "Failed"
};

export function StaffDashboard({
  initialOrders,
  initialSettings,
  staffEmail
}: {
  initialOrders: StaffOrderView[];
  initialSettings: StoreSettings;
  staffEmail: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [settings, setSettings] = useState(initialSettings);
  const [tab, setTab] = useState<Tab>("active");
  const [actionId, setActionId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(0);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/staff/orders", { cache: "no-store" });
        if (!response.ok) throw new Error("Refresh failed");
        const data = (await response.json()) as { orders: StaffOrderView[] };
        if (!cancelled) {
          setOrders(data.orders);
          setLastUpdated(new Date());
          setRefreshError(false);
        }
      } catch {
        if (!cancelled) setRefreshError(true);
      }
    };
    const timer = window.setInterval(refresh, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(
    () => ({
      cooking: orders.filter((order) => order.status === "PAID").length,
      ready: orders.filter((order) => order.status === "READY").length,
      paying: orders.filter((order) => order.status === "PENDING_PAYMENT").length,
      collected: orders.filter((order) => order.status === "PICKED_UP").length
    }),
    [orders]
  );

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          if (tab === "active") return ["PAID", "READY"].includes(order.status);
          if (tab === "upcoming") return order.status === "PENDING_PAYMENT";
          if (tab === "done") return order.status === "PICKED_UP";
          return true;
        })
        .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt)),
    [orders, tab]
  );

  async function orderAction(order: StaffOrderView, kind: "ready" | "picked-up") {
    setActionId(order.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/staff/orders/${order.id}/${kind}`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        order?: StaffOrderView;
        warning?: string | null;
        error?: string;
      };
      if (!response.ok || !data.order) throw new Error(data.error || "Unable to update the order.");
      setOrders((current) => current.map((entry) => (entry.id === data.order!.id ? data.order! : entry)));
      setNotice({
        tone: data.warning ? "warn" : "good",
        text: data.warning || (kind === "ready" ? `${order.orderCode} is ready. Customer email queued.` : `${order.orderCode} collected.`)
      });
    } catch (reason) {
      setNotice({
        tone: "warn",
        text: reason instanceof Error ? reason.message : "Unable to update the order."
      });
    } finally {
      setActionId(null);
    }
  }

  async function saveSettings(next: StoreSettings, successMessage = "Settings saved.") {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/staff/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptingOrders: next.acceptingOrders,
          prepLeadMinutes: next.prepLeadMinutes,
          slotMinutes: next.slotMinutes,
          slotCapacity: next.slotCapacity,
          openTime: next.openTime,
          closeTime: next.closeTime
        })
      });
      const data = (await response.json().catch(() => ({}))) as StoreSettings & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save settings.");
      setSettings(data);
      setNotice({ tone: "good", text: successMessage });
    } catch (reason) {
      setNotice({ tone: "warn", text: reason instanceof Error ? reason.message : "Unable to save settings." });
    } finally {
      setSavingSettings(false);
    }
  }

  async function signOut() {
    await fetch("/api/staff/auth/logout", { method: "POST" });
    window.location.href = "/staff/login";
  }

  function updateSetting<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="min-h-dvh pb-12">
      <header className="border-b border-ink/8 bg-paper/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-yuzu text-xl ring-1 ring-ink/10">🍱</span>
            <div>
              <p className="whitespace-nowrap font-display text-lg font-black leading-none tracking-tight">Kitchen screen</p>
              <p className="mt-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.16em] text-leaf">
                {settings.acceptingOrders ? "Taking orders" : "Orders paused"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] font-semibold text-ink/35 sm:block">{staffEmail}</span>
            <a href="/" aria-label="Open customer view" className="whitespace-nowrap rounded-full bg-paper px-3 py-2 text-[10px] font-extrabold text-ink/50 ring-1 ring-ink/8 hover:text-ink">
              Menu
            </a>
            <button type="button" onClick={signOut} className="whitespace-nowrap rounded-full px-2.5 py-2 text-[10px] font-extrabold text-ink/35 hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {notice ? (
          <div
            className={cn(
              "mb-4 flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-xs font-semibold shadow-sm",
              notice.tone === "good" ? "bg-nori text-white" : "bg-chili/10 text-chili ring-1 ring-chili/20"
            )}
            role="status"
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-50 hover:opacity-100">×</button>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cooking now" value={counts.cooking} tone="yuzu" />
          <StatCard label="Ready to collect" value={counts.ready} tone="leaf" />
          <StatCard label="Still paying" value={counts.paying} tone="plain" />
          <StatCard label="Collected" value={counts.collected} tone="plain" />
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-ink/8 bg-paper p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-leaf">Lunch service</p>
              <h1 className="mt-0.5 font-display text-3xl font-black tracking-tight">Today&apos;s queue</h1>
              <p className="mt-1 text-[10px] font-semibold text-ink/35">
                {lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : "Auto-refreshes every 15 seconds"}
                {refreshError ? " · connection issue" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings((value) => !value)}
                className="rounded-full border border-ink/10 bg-paper px-3.5 py-2 text-xs font-extrabold text-ink/55 transition hover:text-ink"
              >
                Settings
              </button>
              <button
                type="button"
                disabled={savingSettings}
                onClick={() =>
                  saveSettings(
                    { ...settings, acceptingOrders: !settings.acceptingOrders },
                    settings.acceptingOrders ? "New orders paused." : "New orders resumed."
                  )
                }
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-black shadow-sm transition disabled:opacity-50",
                  settings.acceptingOrders ? "bg-paper text-chili ring-1 ring-chili/15" : "bg-moss text-white"
                )}
              >
                {settings.acceptingOrders ? "Pause orders" : "Resume orders"}
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-ink/8 bg-rice/70 p-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <NumberSetting label="Prep lead (min)" value={settings.prepLeadMinutes} min={0} max={120} onChange={(value) => updateSetting("prepLeadMinutes", value)} />
              <NumberSetting label="Slot gap (min)" value={settings.slotMinutes} min={5} max={60} onChange={(value) => updateSetting("slotMinutes", value)} />
              <NumberSetting label="Orders / slot" value={settings.slotCapacity} min={1} max={50} onChange={(value) => updateSetting("slotCapacity", value)} />
              <TimeSetting label="Open" value={settings.openTime} onChange={(value) => updateSetting("openTime", value)} />
              <TimeSetting label="Close" value={settings.closeTime} onChange={(value) => updateSetting("closeTime", value)} />
              <div className="sm:col-span-2 lg:col-span-5">
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => saveSettings(settings)}
                  className="rounded-xl bg-moss px-4 py-2 text-xs font-black text-white transition hover:bg-nori disabled:opacity-50"
                >
                  {savingSettings ? "Saving…" : "Save service settings"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Order filters">
            {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-wide transition",
                  tab === key ? "bg-moss text-white" : "bg-ink/5 text-ink/45 hover:text-ink"
                )}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleOrders.length ? (
              visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  timezone={settings.timezone}
                  busy={actionId === order.id}
                  onReady={() => orderAction(order, "ready")}
                  onPickedUp={() => orderAction(order, "picked-up")}
                />
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-ink/12 bg-rice/40 px-5 py-12 text-center">
                <p className="text-3xl" aria-hidden="true">🥢</p>
                <p className="mt-2 font-display text-lg font-black text-ink/55">Nothing in this queue.</p>
                <p className="mt-1 text-xs text-ink/35">Orders will appear here automatically.</p>
              </div>
            )}
          </div>
        </section>

        <p className="mt-5 text-center text-[9px] font-semibold leading-relaxed text-ink/30">
          Ready sends the customer email and updates Square fulfillment to PREPARED. Collected completes the Square order.
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "yuzu" | "leaf" | "plain" }) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", tone === "yuzu" ? "border-chili/25 bg-chili/10" : tone === "leaf" ? "border-ink/15 bg-ink/5" : "border-ink/8 bg-paper")}>
      <p className="font-display text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-ink/40">{label}</p>
    </div>
  );
}

function OrderCard({
  order,
  now,
  timezone,
  busy,
  onReady,
  onPickedUp
}: {
  order: StaffOrderView;
  now: number;
  timezone: string;
  busy: boolean;
  onReady: () => void;
  onPickedUp: () => void;
}) {
  const pickup = new Date(order.pickupAt).getTime();
  const minutes = now ? Math.round((pickup - now) / 60_000) : null;
  const late = minutes !== null && minutes < -2;
  const urgent = minutes !== null && minutes <= 5 && minutes >= -2;

  return (
    <article
      className={cn(
        "flex min-h-[18rem] flex-col rounded-2xl border bg-paper p-4 shadow-sm",
        order.status === "READY" ? "border-ink/35 ring-2 ring-ink/10" : "border-ink/8",
        late && order.status !== "READY" && "border-chili/30"
      )}
      data-testid={`staff-order-${order.orderCode}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-black tracking-[0.04em]">{order.orderCode}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-ink/38">{order.customerName}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide", STATUS_STYLES[order.status])}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2 rounded-xl bg-rice/80 px-3 py-2">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-ink/35">Pickup</p>
          <p className="text-sm font-black">{formatTime(order.pickupAt, timezone)}</p>
        </div>
        {minutes !== null ? (
          <span className={cn("text-[10px] font-black", late ? "text-chili" : urgent ? "text-ink" : "text-ink/40")}>
            {late ? `${Math.abs(minutes)} min late` : minutes === 0 ? "Now" : `in ${minutes} min`}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {order.lines.map((line) => (
          <span key={line.id} className="rounded-full bg-ink/[0.045] px-2 py-1 text-[9px] font-bold text-ink/60">
            {line.name} ×{line.quantity}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-3">
        <div className="mb-2 flex items-center justify-between text-[9px] font-semibold text-ink/30">
          <span className="truncate">{order.customerEmail}</span>
          <span className="shrink-0">{order.boxCapacity} slots · {formatMoney(order.totalCents, order.currency)}</span>
        </div>
        {order.status === "PAID" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onReady}
            className="w-full rounded-xl bg-moss px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-nori disabled:opacity-50"
          >
            {busy ? "Updating…" : "Mark ready → email customer"}
          </button>
        ) : order.status === "READY" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPickedUp}
            className="w-full rounded-xl bg-nori px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-ink/85 disabled:opacity-50"
          >
            {busy ? "Updating…" : "Mark picked up"}
          </button>
        ) : (
          <div className="rounded-xl bg-ink/[0.035] px-4 py-3 text-center text-[10px] font-bold text-ink/35">
            {order.status === "PICKED_UP" ? "Collected" : order.status === "PENDING_PAYMENT" ? "Waiting for payment" : "No kitchen action"}
          </div>
        )}
      </div>
    </article>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-ink/40">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
        className="w-full rounded-lg border border-ink/10 bg-paper px-2.5 py-2 text-sm font-bold outline-none focus:border-chili"
      />
    </label>
  );
}

function TimeSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-ink/40">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-ink/10 bg-paper px-2.5 py-2 text-sm font-bold outline-none focus:border-chili"
      />
    </label>
  );
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}
