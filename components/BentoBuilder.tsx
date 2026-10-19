"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { BentoBoard, type BoardPortion } from "@/components/bento/BentoBoard";
import { IngredientCard } from "@/components/bento/IngredientCard";
import { CheckoutPanel, type SummaryLine } from "@/components/CheckoutPanel";
import { cn, formatMoney } from "@/lib/utils";
import type {
  BentoSection,
  CatalogItem,
  CatalogSnapshot,
  PickupSlot,
  PublicConfig
} from "@/lib/types";

interface AvailabilityResponse {
  slots: PickupSlot[];
  timezone: string;
  acceptingOrders: boolean;
}

const SECTION_META: Record<
  Exclude<BentoSection, "box">,
  { title: string; kicker: string; icon: string; note: string; required: boolean }
> = {
  protein: {
    title: "Pick your protein",
    kicker: "The main event",
    icon: "🍗",
    note: "At least 1",
    required: true
  },
  vegetable: {
    title: "Pile on the veg",
    kicker: "Colour & crunch",
    icon: "🥦",
    note: "At least 1",
    required: true
  },
  starch: {
    title: "Choose a starch",
    kicker: "The happy base",
    icon: "🍚",
    note: "Optional",
    required: false
  }
};

const DIETARY_FILTERS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "gluten-free", label: "Gluten free" },
  { key: "high-protein", label: "High protein" }
] as const;

const ALLERGEN_FILTERS = [
  { key: "fish", label: "No fish" },
  { key: "shellfish", label: "No shellfish" },
  { key: "egg", label: "No egg" },
  { key: "milk", label: "No dairy" },
  { key: "soy", label: "No soy" },
  { key: "gluten", label: "No gluten" },
  { key: "sesame", label: "No sesame" },
  { key: "nuts", label: "No nuts" }
] as const;

export function BentoBuilder({ config }: { config: PublicConfig }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeBoxId, setActiveBoxId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [dietaryFilters, setDietaryFilters] = useState<Set<string>>(() => new Set());
  const [allergenFilters, setAllergenFilters] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetch("/api/menu", { cache: "no-store" }).then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as CatalogSnapshot & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load today's menu.");
        return data;
      }),
      fetch("/api/availability", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as AvailabilityResponse;
        })
        .catch(() => null)
    ])
      .then(([nextSnapshot, nextAvailability]) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setAvailability(nextAvailability);
        const firstBox = nextSnapshot.items.find((item) => item.section === "box" && !item.soldOut);
        setActiveBoxId(firstBox?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Unable to load the menu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const catalog = snapshot?.items ?? [];
  const boxes = useMemo(() => catalog.filter((item) => item.section === "box"), [catalog]);
  const box = boxes.find((item) => item.id === activeBoxId) ?? boxes.find((item) => !item.soldOut) ?? null;
  const capacity = box?.capacity ?? 6;
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .map(([itemId, quantity]) => {
          const item = catalogById.get(itemId);
          return item ? { item, quantity } : null;
        })
        .filter((entry): entry is { item: CatalogItem; quantity: number } => Boolean(entry)),
    [catalogById, quantities]
  );

  const portions = useMemo<BoardPortion[]>(
    () =>
      selectedItems.flatMap(({ item, quantity }) =>
        Array.from({ length: quantity }, (_, index) => ({ key: `${item.id}-${index}`, item }))
      ),
    [selectedItems]
  );

  const totalPortions = portions.length;
  const proteinCount = selectedItems
    .filter((entry) => entry.item.section === "protein")
    .reduce((total, entry) => total + entry.quantity, 0);
  const vegetableCount = selectedItems
    .filter((entry) => entry.item.section === "vegetable")
    .reduce((total, entry) => total + entry.quantity, 0);
  const starchCount = selectedItems
    .filter((entry) => entry.item.section === "starch")
    .reduce((total, entry) => total + entry.quantity, 0);
  const totalCents = selectedItems.reduce(
    (total, entry) => total + entry.item.priceCents * entry.quantity,
    0
  );
  const valid = Boolean(box) && proteinCount >= 1 && vegetableCount >= 1 && totalPortions <= capacity;

  const selections = useMemo(
    () => selectedItems.map((entry) => ({ itemId: entry.item.id, quantity: entry.quantity })),
    [selectedItems]
  );
  const summaryLines = useMemo<SummaryLine[]>(
    () =>
      selectedItems.map((entry) => ({
        itemId: entry.item.id,
        name: entry.item.name,
        quantity: entry.quantity,
        lineTotalCents: entry.item.priceCents * entry.quantity
      })),
    [selectedItems]
  );

  function matchesFilters(item: CatalogItem): boolean {
    const dietaryMatch = [...dietaryFilters].every((tag) => item.dietaryTags.includes(tag));
    const allergenMatch = !item.allergens.some((allergen) => allergenFilters.has(allergen));
    return dietaryMatch && allergenMatch;
  }

  const filteredBySection = useMemo(() => {
    const result: Record<Exclude<BentoSection, "box">, CatalogItem[]> = {
      protein: [],
      vegetable: [],
      starch: []
    };
    for (const item of catalog) {
      if (item.section === "box" || item.soldOut) continue;
      if (matchesFilters(item)) result[item.section].push(item);
    }
    return result;
  }, [allergenFilters, catalog, dietaryFilters]);

  const filteredOutSelections = selectedItems.filter(({ item }) => !matchesFilters(item));
  const filterCount = dietaryFilters.size + allergenFilters.size;

  function addItem(item: CatalogItem) {
    if (item.soldOut) return;
    if (totalPortions >= capacity) {
      setNotice("That box is full. Remove a portion or switch to the Large box.");
      return;
    }
    setNotice(null);
    setQuantities((current) => ({
      ...current,
      [item.id]: (current[item.id] ?? 0) + 1
    }));
  }

  function removeItem(item: CatalogItem) {
    setNotice(null);
    setQuantities((current) => {
      const nextQuantity = (current[item.id] ?? 0) - 1;
      const next = { ...current };
      if (nextQuantity <= 0) delete next[item.id];
      else next[item.id] = nextQuantity;
      return next;
    });
  }

  function selectBox(id: string) {
    if (id === activeBoxId) return;
    setActiveBoxId(id);
    setQuantities({});
    setNotice("Fresh box. Time to fill it up.");
  }

  function clearBox() {
    setQuantities({});
    setNotice(null);
  }

  function chefPick() {
    if (!box?.capacity) return;
    const pool = {
      protein: filteredBySection.protein,
      vegetable: filteredBySection.vegetable,
      starch: filteredBySection.starch
    };
    if (pool.protein.length === 0 || pool.vegetable.length === 0) {
      setNotice("Chef cannot meet those filters. Try removing one of them.");
      return;
    }

    const proteinTarget = Math.max(1, Math.round(capacity * 0.33));
    const vegTarget = Math.max(1, Math.round(capacity * 0.5));
    const starchTarget = Math.max(0, capacity - proteinTarget - vegTarget);
    const next: Record<string, number> = {};

    function fill(section: keyof typeof pool, target: number) {
      const items = pool[section];
      for (let index = 0; index < target; index += 1) {
        const item = items[index % items.length];
        next[item.id] = (next[item.id] ?? 0) + 1;
      }
    }

    fill("protein", proteinTarget);
    fill("vegetable", vegTarget);
    fill("starch", starchTarget);
    setQuantities(next);
    setNotice("Chef packed a balanced box. Swap anything you like.");
  }

  function toggleFilter(
    setter: Dispatch<SetStateAction<Set<string>>>,
    value: string
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearFilters() {
    setDietaryFilters(new Set());
    setAllergenFilters(new Set());
  }

  function openCheckout() {
    if (!valid || !box) {
      setNotice("Add at least one protein and one vegetable before checking out.");
      return;
    }
    setCheckoutOpen(true);
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div className="pointer-events-none absolute -right-24 top-16 text-[12rem] opacity-[0.045] sm:text-[18rem]" aria-hidden="true">
        🍱
      </div>

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 pt-5 sm:px-6">
        <a href="/" className="group flex items-center gap-2.5" aria-label="Bento Lab home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-yuzu text-xl shadow-sm ring-1 ring-ink/10 transition group-hover:-rotate-3">
            🍱
          </span>
          <span>
            <span className="block font-display text-lg font-black leading-none tracking-tight">Bento Lab</span>
            <span className="block text-[9px] font-black uppercase tracking-[0.19em] text-leaf">Build your lunch</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {snapshot?.source === "demo" ? (
            <span className="rounded-full bg-yuzu/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-ink/55 ring-1 ring-yuzu/40">
              Demo menu
            </span>
          ) : null}
          <a
            href="/staff"
            className="rounded-full px-3 py-2 text-xs font-extrabold text-ink/45 transition hover:bg-ink/5 hover:text-ink"
          >
            Staff
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-36 pt-6 sm:px-6 sm:pb-32 lg:pb-16 lg:pt-12">
        <section className="relative">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-leaf shadow-sm ring-1 ring-ink/5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
                </span>
                {availability ? (availability.acceptingOrders ? "Kitchen open" : "Orders paused") : "Fresh today"}
              </span>
              <span className="rounded-full bg-paper/75 px-2.5 py-1 text-[9px] font-bold text-ink/45 ring-1 ring-ink/5">
                Ready in about 10 minutes
              </span>
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.45rem,9vw,6.7rem)] font-black leading-[0.9] tracking-[-0.055em]">
              Your lunch.
              <span className="ml-2 inline-block -rotate-2 rounded-2xl bg-yuzu px-2 pb-1 pt-0.5 text-moss sm:ml-4">
                Your rules.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[13px] font-medium leading-relaxed text-ink/55 sm:text-lg">
              Pick a box, choose every little thing inside, and skip the lunch queue. We will have it packed and
              waiting when you walk in.
            </p>
          </div>
          <div className="pointer-events-none absolute right-[5%] top-24 hidden xl:block" aria-hidden="true">
            <div className="animate-float text-7xl drop-shadow-sm">🥢</div>
          </div>
        </section>

        {loadError ? (
          <section className="mt-10 rounded-[2rem] border border-chili/15 bg-paper p-6 shadow-soft">
            <p className="font-display text-xl font-black">The menu missed the bus.</p>
            <p className="mt-2 text-sm text-ink/55">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="mt-4 rounded-full bg-moss px-5 py-2.5 text-sm font-extrabold text-white"
            >
              Try again
            </button>
          </section>
        ) : loading ? (
          <BuilderSkeleton />
        ) : !box ? (
          <section className="mt-10 rounded-[2rem] border border-yuzu/30 bg-paper p-6 shadow-soft">
            <p className="font-display text-2xl font-black">All bento boxes are sold out.</p>
            <p className="mt-2 text-sm text-ink/55">Please check back tomorrow or ask the team at the counter.</p>
          </section>
        ) : (
          <div id="builder" className="mt-9 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="order-1 min-w-0 lg:order-1">
              <div className="rounded-2xl border border-ink/8 bg-paper/55 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-leaf">Filter the menu</p>
                    <p className="mt-0.5 text-xs font-medium text-ink/45">
                      Allergen filters hide matching ingredients.
                    </p>
                  </div>
                  {filterCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-full bg-ink/5 px-3 py-1.5 text-[10px] font-extrabold text-ink/55 transition hover:bg-ink/10"
                    >
                      Clear {filterCount} filter{filterCount === 1 ? "" : "s"}
                    </button>
                  ) : null}
                </div>
                <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Dietary filters">
                  {DIETARY_FILTERS.map((filter) => (
                    <FilterChip
                      key={filter.key}
                      label={filter.label}
                      active={dietaryFilters.has(filter.key)}
                      onClick={() => toggleFilter(setDietaryFilters, filter.key)}
                    />
                  ))}
                </div>
                <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Allergen filters">
                  {ALLERGEN_FILTERS.map((filter) => (
                    <FilterChip
                      key={filter.key}
                      label={filter.label}
                      active={allergenFilters.has(filter.key)}
                      onClick={() => toggleFilter(setAllergenFilters, filter.key)}
                      allergen
                    />
                  ))}
                </div>
              </div>

              {filteredOutSelections.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-yuzu/35 bg-yuzu/15 px-3.5 py-2.5">
                  <p className="text-[11px] font-bold text-ink/60">
                    {filteredOutSelections.reduce((total, entry) => total + entry.quantity, 0)} chosen portion
                    {filteredOutSelections.reduce((total, entry) => total + entry.quantity, 0) === 1 ? "" : "s"} hidden by
                    your filters.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[10px] font-black uppercase tracking-wide text-moss underline underline-offset-2"
                  >
                    Show everything
                  </button>
                </div>
              ) : null}

              {notice ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-moss px-4 py-3 text-xs font-semibold text-white shadow-sm" role="status">
                  <span>{notice}</span>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="text-white/60 hover:text-white">
                    ×
                  </button>
                </div>
              ) : null}

              <div className="mt-6 space-y-8 sm:space-y-9">
                {(["protein", "vegetable", "starch"] as const).map((section) => {
                  const meta = SECTION_META[section];
                  const items = filteredBySection[section];
                  return (
                    <section key={section} aria-labelledby={`section-${section}`}>
                      <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl" aria-hidden="true">{meta.icon}</span>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-leaf">{meta.kicker}</p>
                          </div>
                          <h2 id={`section-${section}`} className="mt-0.5 font-display text-xl font-black tracking-tight sm:text-2xl">
                            {meta.title}
                          </h2>
                        </div>
                        <span
                          className={cn(
                            "mb-1 shrink-0 text-[9px] font-black uppercase tracking-[0.14em]",
                            meta.required ? "text-chili/70" : "text-ink/35"
                          )}
                        >
                          {meta.note}
                        </span>
                      </div>
                      {items.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                          {items.map((item) => (
                            <IngredientCard
                              key={item.id}
                              item={item}
                              quantity={quantities[item.id] ?? 0}
                              onAdd={addItem}
                              onRemove={removeItem}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-ink/12 bg-paper/60 p-5 text-center">
                          <p className="text-sm font-bold text-ink/45">No {section} matches those filters.</p>
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-2 text-xs font-extrabold text-moss underline underline-offset-2"
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>

              <div className="mt-10 rounded-[1.75rem] bg-moss p-5 text-white shadow-soft sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">👩‍🍳</span>
                  <div>
                    <p className="font-display text-lg font-black">A note from the kitchen</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/65">
                      Everything is made in small batches. If you have a serious allergy, please speak with our team
                      before ordering — we handle many allergens in the same kitchen.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="order-2 hidden self-start lg:sticky lg:top-4 lg:block">
              <BentoBoard
                boxes={boxes}
                activeBoxId={box.id}
                onSelectBox={selectBox}
                box={box}
                portions={portions}
                totalCents={totalCents}
                proteinCount={proteinCount}
                vegetableCount={vegetableCount}
                starchCount={starchCount}
                totalPortions={totalPortions}
                onRemove={removeItem}
                onClear={clearBox}
                onChefPick={chefPick}
              />
              <button
                type="button"
                onClick={openCheckout}
                className={cn(
                  "mt-3 hidden w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black shadow-lg transition lg:flex",
                  valid
                    ? "bg-moss text-white hover:-translate-y-0.5 hover:bg-nori hover:shadow-xl"
                    : "cursor-not-allowed bg-ink/10 text-ink/35 shadow-none"
                )}
              >
                Review & pay
                <span aria-hidden="true">→</span>
              </button>
              {!valid ? (
                <p className="mt-2 hidden text-center text-[10px] font-semibold text-ink/40 lg:block">
                  Add 1 protein + 1 vegetable to continue.
                </p>
              ) : null}
            </aside>
          </div>
        )}

        <footer className="mt-16 border-t border-ink/8 pb-6 pt-6 text-center text-[10px] font-semibold leading-relaxed text-ink/35">
          <p>{config.storeName} · {config.storeAddress}</p>
          <p className="mt-1">Made fresh today. Prices include GST. Same-day pickup only.</p>
        </footer>
      </main>

      {!loading && box && !loadError ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper/95 px-4 pt-3 shadow-[0_-12px_35px_rgba(28,36,31,.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl font-black">{formatMoney(totalCents, config.currency)}</span>
                <span className="text-[10px] font-bold text-ink/40">{totalPortions}/{capacity} slots</span>
              </div>
              <p className="truncate text-[9px] font-bold text-ink/40">
                {proteinCount < 1 && vegetableCount < 1
                  ? "Add a protein + vegetable"
                  : proteinCount < 1
                    ? "Add a protein"
                    : vegetableCount < 1
                      ? "Add a vegetable"
                      : "Box looking good"}
              </p>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              disabled={!valid}
              className={cn(
                "shrink-0 rounded-xl px-5 py-3 text-sm font-black transition",
                valid ? "bg-moss text-white shadow-md active:scale-[0.98]" : "cursor-not-allowed bg-ink/10 text-ink/35"
              )}
            >
              Review & pay
            </button>
          </div>
        </div>
      ) : null}

      {box ? (
        <CheckoutPanel
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(token) => router.push(`/order/${token}?new=1`)}
          config={config}
          box={box}
          selections={selections}
          summaryLines={summaryLines}
          totalCents={totalCents}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  allergen = false
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  allergen?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition",
        active
          ? allergen
            ? "border-chili/30 bg-chili/10 text-chili"
            : "border-moss bg-moss text-white"
          : "border-ink/8 bg-transparent text-ink/50 hover:border-leaf/30 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function BuilderSkeleton() {
  return (
    <div className="mt-9 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="order-2 space-y-5 lg:order-1">
        <div className="h-28 animate-pulse rounded-3xl bg-ink/8" />
        {[0, 1, 2].map((section) => (
          <div key={section}>
            <div className="mb-3 h-10 w-52 animate-pulse rounded-xl bg-ink/8" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3].map((card) => (
                <div key={card} className="h-36 animate-pulse rounded-3xl bg-ink/8" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="order-1 h-[34rem] animate-pulse rounded-[2rem] bg-ink/8 lg:order-2" />
    </div>
  );
}
