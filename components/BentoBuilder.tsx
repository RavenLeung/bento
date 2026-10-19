"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from "react";
import { useRouter } from "next/navigation";
import { BentoBoard, type BoardPortion } from "@/components/bento/BentoBoard";
import { BentoSheet } from "@/components/bento/BentoSheet";
import { BentoSummaryTray } from "@/components/bento/BentoSummaryTray";
import { IngredientCard } from "@/components/bento/IngredientCard";
import { ItemImage } from "@/components/bento/ItemImage";
import { CheckoutPanel, type SummaryLine } from "@/components/CheckoutPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DESKTOP_BENTO_DROP_ID,
  MOBILE_BENTO_DROP_ID,
  TOUCH_DRAG_DELAY_MS,
  TOUCH_DRAG_TOLERANCE_PX,
  type MenuDragData
} from "@/lib/bento-dnd";
import { cn } from "@/lib/utils";
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

const DRAG_HINT_IDLE_MS = 3_000;
const DRAG_HINT_DURATION_MS = 2_200;
const DRAG_HINT_ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "touchmove",
  "scroll"
] as const;

type DragHintStyle = CSSProperties & {
  "--hint-mid-x": string;
  "--hint-mid-y": string;
  "--hint-end-x": string;
  "--hint-end-y": string;
};

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
  const [bentoSheetOpen, setBentoSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<CatalogItem | null>(null);
  const [showDragHint, setShowDragHint] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_DRAG_DELAY_MS,
        tolerance: TOUCH_DRAG_TOLERANCE_PX
      }
    })
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktop(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

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
  const dragHintItem =
    filteredBySection.protein[0] ??
    filteredBySection.vegetable[0] ??
    filteredBySection.starch[0] ??
    null;

  useEffect(() => {
    if (
      loading ||
      !box ||
      !dragHintItem ||
      totalPortions > 0 ||
      checkoutOpen ||
      bentoSheetOpen ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const targetId = isDesktop ? DESKTOP_BENTO_DROP_ID : MOBILE_BENTO_DROP_ID;
    if (!document.querySelector(`[data-testid="${targetId}"]`)) return;

    let timer: number | undefined;
    const armIdleTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setShowDragHint(true);
        timer = window.setTimeout(() => {
          setShowDragHint(false);
          armIdleTimer();
        }, DRAG_HINT_DURATION_MS);
      }, DRAG_HINT_IDLE_MS);
    };
    const handleActivity = () => {
      setShowDragHint(false);
      armIdleTimer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer !== undefined) window.clearTimeout(timer);
        setShowDragHint(false);
      } else {
        armIdleTimer();
      }
    };

    armIdleTimer();
    for (const eventName of DRAG_HINT_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      for (const eventName of DRAG_HINT_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [bentoSheetOpen, box, checkoutOpen, dragHintItem, isDesktop, loading, totalPortions]);

  function dismissDragHint() {
    setShowDragHint(false);
  }

  function addItem(item: CatalogItem, successNotice: string | null = null) {
    dismissDragHint();
    if (item.soldOut) return;
    if (totalPortions >= capacity) {
      setNotice("That box is full. Remove a portion or switch to the Large box.");
      return;
    }
    setNotice(successNotice);
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
    dismissDragHint();
    const pool = {
      protein: filteredBySection.protein,
      vegetable: filteredBySection.vegetable,
      starch: filteredBySection.starch
    };
    if (pool.protein.length === 0 || pool.vegetable.length === 0) {
      setNotice("Pick For Me cannot meet those filters. Try removing one of them.");
      return;
    }

    const next: Record<string, number> = {};

    function fillRandomly(items: CatalogItem[], count: number) {
      const shuffled = [...items];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      for (let index = 0; index < count; index += 1) {
        const item = shuffled[index % shuffled.length];
        next[item.id] = (next[item.id] ?? 0) + 1;
      }
    }

    fillRandomly(pool.protein, 2);
    fillRandomly(pool.vegetable, 3);
    if (pool.starch.length > 0) fillRandomly(pool.starch, 1);
    setQuantities(next);
    setNotice("Picked a random mix for you. Swap anything you like.");
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
    dismissDragHint();
    if (!valid || !box) {
      setNotice("Add at least one protein and one vegetable before checking out.");
      return;
    }
    setBentoSheetOpen(false);
    setCheckoutOpen(true);
  }

  function handleDragStart(event: DragStartEvent) {
    dismissDragHint();
    const item = (event.active.data.current as MenuDragData | undefined)?.item;
    setActiveDragItem(item ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const item = (event.active.data.current as MenuDragData | undefined)?.item;
    const expectedDropId = isDesktop ? DESKTOP_BENTO_DROP_ID : MOBILE_BENTO_DROP_ID;
    setActiveDragItem(null);
    if (!item || event.over?.id !== expectedDropId) return;
    addItem(item, `${item.name} added to your bento.`);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragItem(null)}
    >
      <div className="relative min-h-dvh overflow-x-clip">
      <div className="pointer-events-none absolute -right-24 top-16 text-[12rem] opacity-[0.045] sm:text-[18rem]" aria-hidden="true">
        🍱
      </div>

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 pt-5 sm:px-6">
        <a href="/" className="group flex items-center gap-2.5" aria-label="Gemeshi Bento Lab home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-yuzu text-xl shadow-sm ring-1 ring-ink/10 transition group-hover:-rotate-3">
            🍱
          </span>
          <span>
            <span className="block whitespace-nowrap font-display text-[15px] font-black leading-none tracking-tight sm:text-lg">Gemeshi Bento Lab</span>
            <span className="block whitespace-nowrap text-[9px] font-black uppercase tracking-[0.16em] text-leaf">Build your lunch</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {snapshot?.source === "demo" ? (
            <span className="hidden whitespace-nowrap rounded-full bg-yuzu/25 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-ink/55 ring-1 ring-yuzu/40 min-[430px]:inline-flex sm:text-[9px]">
              Demo menu
            </span>
          ) : null}
          <ThemeToggle />
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
              <span className="ml-2 inline-block -rotate-2 rounded-2xl bg-yuzu px-2 pb-1 pt-0.5 text-nori sm:ml-4">
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
                <p className="mt-2 text-[10px] font-semibold leading-relaxed text-ink/40">
                  <span className="lg:hidden">Hold a dish, then drag it onto the bento tray below.</span>
                  <span className="hidden lg:inline">Drag any dish into your bento panel, or tap Add.</span>
                </p>
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
                <div
                  data-testid="builder-notice"
                  className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-moss px-4 py-3 text-xs font-semibold text-white shadow-sm"
                  role="status"
                >
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
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
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
                droppableId={DESKTOP_BENTO_DROP_ID}
                dropEnabled={isDesktop}
                dragActive={Boolean(activeDragItem)}
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

      {!loading && box && !loadError && !checkoutOpen && !bentoSheetOpen ? (
        <BentoSummaryTray
          box={box}
          portions={portions}
          capacity={capacity}
          totalCents={totalCents}
          valid={valid}
          proteinCount={proteinCount}
          vegetableCount={vegetableCount}
          currency={config.currency}
          onOpen={() => {
            dismissDragHint();
            setBentoSheetOpen(true);
          }}
          onCheckout={openCheckout}
          droppableId={MOBILE_BENTO_DROP_ID}
          dropEnabled={!isDesktop}
          dragActive={Boolean(activeDragItem)}
        />
      ) : null}

      {box ? (
        <BentoSheet
          open={bentoSheetOpen}
          onClose={() => setBentoSheetOpen(false)}
          onCheckout={openCheckout}
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
          valid={valid}
          currency={config.currency}
          onRemove={removeItem}
          onClear={clearBox}
          onChefPick={chefPick}
        />
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
      {showDragHint && dragHintItem ? (
        <DragOnboarding
          item={dragHintItem}
          targetId={isDesktop ? DESKTOP_BENTO_DROP_ID : MOBILE_BENTO_DROP_ID}
        />
      ) : null}
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? <DragPreview item={activeDragItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragPreview({ item }: { item: CatalogItem }) {
  return (
    <div
      data-testid="drag-overlay"
      className="pointer-events-none w-[min(18rem,calc(100vw-2rem))] rotate-2 rounded-2xl border border-moss/25 bg-paper/95 p-3 shadow-2xl backdrop-blur-md"
    >
      <div className="animate-drag-preview flex items-center gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/70">
          <ItemImage item={item} sizes="56px" emojiClassName="text-3xl" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black leading-tight">{item.name}</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-leaf">
            Drop into your bento
          </p>
        </div>
      </div>
    </div>
  );
}

function DragOnboarding({ item, targetId }: { item: CatalogItem; targetId: string }) {
  const [style, setStyle] = useState<DragHintStyle | null>(null);

  useEffect(() => {
    const source = document.querySelector<HTMLElement>(`[data-testid="menu-drag-${item.id}"]`);
    const target = document.querySelector<HTMLElement>(`[data-testid="${targetId}"]`);
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      const width = 154;
      const height = 58;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), Math.max(min, max));
      const sourceRect = source?.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const startCenterX = sourceRect ? sourceRect.left + sourceRect.width / 2 : viewportWidth / 2;
      const startCenterY = sourceRect
        ? Math.min(sourceRect.top + sourceRect.height / 2, viewportHeight * 0.72)
        : viewportHeight * 0.55;
      const startLeft = clamp(startCenterX - width / 2, margin, viewportWidth - width - margin);
      const startTop = clamp(startCenterY - height / 2, margin, viewportHeight - height - margin);

      const endCenterX = targetRect.left + targetRect.width / 2;
      const endCenterY =
        targetId === MOBILE_BENTO_DROP_ID
          ? targetRect.top + targetRect.height / 2
          : targetRect.top + Math.min(targetRect.height * 0.24, 150);
      const endLeft = clamp(endCenterX - width / 2, margin, viewportWidth - width - margin);
      const endTop = clamp(endCenterY - height / 2, margin, viewportHeight - height - margin);
      const deltaX = endLeft - startLeft;
      const deltaY = endTop - startTop;
      const arcHeight = Math.min(90, 30 + Math.abs(deltaX) * 0.12);

      setStyle({
        left: `${startLeft}px`,
        top: `${startTop}px`,
        "--hint-mid-x": `${deltaX * 0.52}px`,
        "--hint-mid-y": `${deltaY * 0.4 - arcHeight}px`,
        "--hint-end-x": `${deltaX}px`,
        "--hint-end-y": `${deltaY}px`
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [item.id, targetId]);

  if (!style) return null;

  return (
    <div
      data-testid="drag-onboarding"
      role="status"
      aria-live="polite"
      className="animate-drag-hint-fly pointer-events-none fixed z-40 flex w-[154px] items-center gap-2.5 rounded-2xl border border-leaf/35 bg-paper/85 p-2 shadow-xl backdrop-blur-md"
      style={style}
    >
      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/75">
        <ItemImage item={item} sizes="40px" emojiClassName="text-2xl" />
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-[11px] font-black leading-none">Hold and drag</p>
        <p className="mt-1 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.12em] text-leaf">
          Onto your bento
        </p>
      </div>
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
