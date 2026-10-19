"use client";

import { useDroppable } from "@dnd-kit/core";
import { ItemImage } from "@/components/bento/ItemImage";
import { MAX_SAUCE_PORTIONS } from "@/lib/bento-rules";
import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

export interface BoardPortion {
  key: string;
  item: CatalogItem;
}

interface BentoBoardProps {
  boxes: CatalogItem[];
  activeBoxId: string;
  onSelectBox: (id: string) => void;
  box: CatalogItem | null;
  portions: BoardPortion[];
  saucePortions: BoardPortion[];
  totalCents: number;
  proteinCount: number;
  vegetableCount: number;
  starchCount: number;
  totalPortions: number;
  onRemove: (item: CatalogItem) => void;
  onClear: () => void;
  onChefPick: () => void;
  droppableId?: string;
  dropEnabled?: boolean;
  dragActive?: boolean;
}

export function BentoBoard({
  boxes,
  activeBoxId,
  onSelectBox,
  box,
  portions,
  saucePortions,
  totalCents,
  proteinCount,
  vegetableCount,
  starchCount,
  totalPortions,
  onRemove,
  onClear,
  onChefPick,
  droppableId,
  dropEnabled = false,
  dragActive = false
}: BentoBoardProps) {
  const capacity = box?.capacity ?? 6;
  const sauceCount = saucePortions.length;
  const fillPercent = capacity ? Math.min(100, (totalPortions / capacity) * 100) : 0;
  const missingProtein = proteinCount < 1;
  const missingVegetable = vegetableCount < 1;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? "bento-board-drop",
    disabled: !dropEnabled || !droppableId
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={dropEnabled ? "bento-drop-desktop" : undefined}
      className={cn(
        "relative rounded-[2rem] border border-ink/10 bg-paper p-4 shadow-soft transition duration-200 sm:p-5",
        dropEnabled && dragActive && !isOver && "animate-drop-target-pulse ring-2 ring-leaf/30 ring-offset-2 ring-offset-rice",
        dropEnabled && dragActive && isOver && "ring-2 ring-leaf/35 ring-offset-2 ring-offset-rice",
        dropEnabled && isOver && "scale-[1.01] bg-leaf/[0.045] ring-4 ring-leaf/65"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-leaf">Your bento</p>
          <h2 className="mt-1 font-display text-2xl font-black tracking-tight">Pack it full</h2>
        </div>
        {totalPortions > 0 || sauceCount > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-2 text-xs font-bold text-ink/55 transition hover:bg-ink/5 hover:text-ink"
          >
            Start over
          </button>
        ) : null}
      </div>

      {dropEnabled && dragActive ? (
        <div
          className={cn(
            "mt-3 rounded-2xl border border-dashed px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] transition",
            isOver
              ? "border-leaf bg-leaf/15 text-moss"
              : "border-leaf/35 bg-leaf/[0.045] text-leaf"
          )}
        >
          {isOver ? "Release to add" : "Drop anywhere in this panel"}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Box size">
        {boxes.map((option) => {
          const active = option.id === activeBoxId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              disabled={option.soldOut}
              onClick={() => onSelectBox(option.id)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-moss bg-moss text-white shadow-sm"
                  : "border-ink/10 bg-ink/5 hover:border-leaf/40",
                option.soldOut && "cursor-not-allowed opacity-40"
              )}
            >
              <span className="block text-sm font-extrabold">{option.name.replace(" Bento", "")}</span>
              <span className={cn("block text-[11px]", active ? "text-white/65" : "text-ink/50")}>
                {option.capacity} dishes · free
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[1.7rem] border-[7px] border-nori bg-[#2c2c25] p-2 shadow-inner">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-white/10 to-transparent" />
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-yuzu/75">Gemeshi Bento Lab</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">
            {totalPortions}/{capacity}
          </span>
        </div>
        <div
          className={cn(
            "grid gap-1.5 rounded-[1.2rem] bg-[#e8dcc7] p-1.5 dark:bg-[#3a3a31] sm:gap-2",
            capacity >= 9 ? "grid-cols-3" : "grid-cols-2"
          )}
          aria-label={
            box
              ? `${box.name}, ${totalPortions} of ${capacity} dishes and ${sauceCount} of ${MAX_SAUCE_PORTIONS} sauces filled`
              : "Bento box"
          }
        >
          {Array.from({ length: capacity }).map((_, index) => {
            const portion = portions[index];
            if (!portion) {
              return (
                <div
                  key={`empty-${index}`}
                  className="checker flex aspect-[1.45/1] items-center justify-center rounded-xl border border-dashed border-ink/10 bg-white/25 dark:bg-white/[0.06]"
                  aria-hidden="true"
                >
                  <span className="text-[10px] font-bold text-ink/20">empty</span>
                </div>
              );
            }
            return (
              <button
                key={portion.key}
                type="button"
                onClick={() => onRemove(portion.item)}
                title={`Remove one ${portion.item.name}`}
                aria-label={`Remove one ${portion.item.name}`}
                className="group relative flex aspect-[1.45/1] animate-pop items-center justify-center overflow-hidden rounded-xl border border-black/5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                style={{ backgroundColor: portion.item.color }}
              >
                <ItemImage
                  item={portion.item}
                  sizes={capacity >= 9 ? "(max-width: 640px) 30vw, 120px" : "(max-width: 640px) 45vw, 180px"}
                  className="transition duration-300 group-hover:scale-105"
                  emojiClassName="text-2xl drop-shadow-sm transition group-hover:scale-90 sm:text-3xl"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-nori/90 via-nori/55 to-transparent px-1 pb-1 pt-5 text-center text-[8px] font-black uppercase tracking-wide text-white">
                  {portion.item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 rounded-[1.2rem] border border-ink/8 bg-paper/70 p-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-ink/45">Sauces</span>
          <span
            data-testid="bento-sauce-count"
            className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-ink/50"
          >
            {sauceCount}/{MAX_SAUCE_PORTIONS}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {Array.from({ length: MAX_SAUCE_PORTIONS }).map((_, index) => {
            const portion = saucePortions[index];
            if (!portion) {
              return (
                <div
                  key={`empty-sauce-${index}`}
                  className="flex min-h-10 items-center justify-center rounded-xl border border-dashed border-ink/10 bg-white/25 px-2 text-center text-[8px] font-bold uppercase tracking-wide text-ink/25 dark:bg-white/[0.06]"
                  aria-hidden="true"
                >
                  Optional sauce
                </div>
              );
            }
            return (
              <button
                key={portion.key}
                type="button"
                onClick={() => onRemove(portion.item)}
                title={`Remove one ${portion.item.name}`}
                aria-label={`Remove one ${portion.item.name}`}
                className="group relative flex min-h-10 animate-pop items-center gap-2 overflow-hidden rounded-xl border border-black/5 px-2 py-1 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                style={{ backgroundColor: `${portion.item.color}55` }}
              >
                <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/65">
                  <ItemImage item={portion.item} sizes="28px" emojiClassName="text-base" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[8px] font-black uppercase tracking-wide text-ink/70">
                  {portion.item.name}
                </span>
                <span className="shrink-0 text-xs font-black text-ink/35 group-hover:text-chili" aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-ink/55">
            {missingProtein || missingVegetable ? "A little more to go" : "Ready to roll"}
          </span>
          <span className="font-black tabular-nums">
            {totalPortions} / {capacity}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/8" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={totalPortions}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              totalPortions >= capacity ? "bg-chili" : "bg-gradient-to-r from-leaf to-yuzu"
            )}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <MacroPill label="Protein" value={proteinCount} required />
          <MacroPill label="Veg" value={vegetableCount} required />
          <MacroPill label="Starch" value={starchCount} />
        </div>
      </div>

      <div
        className={cn(
          "mt-3 rounded-2xl px-3 py-2.5 text-xs font-semibold leading-relaxed",
          missingProtein || missingVegetable
            ? "bg-yuzu/20 text-ink/70"
            : "bg-leaf/10 text-moss"
        )}
        aria-live="polite"
      >
        {missingProtein && missingVegetable
          ? "Add at least one protein and one vegetable."
          : missingProtein
            ? "One protein and you are good to go."
            : missingVegetable
              ? "Add a vegetable to round it out."
              : totalPortions >= capacity
                ? "Every slot filled. That is a proper bento."
                : "Nice balance. Add more if you are hungry."}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-ink/10 pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">Your total</p>
          <p className="font-display text-3xl font-black tracking-tight">{formatMoney(totalCents)}</p>
          <p className="text-[10px] font-semibold text-ink/40">GST included</p>
        </div>
        <button
          type="button"
          onClick={onChefPick}
          className="rounded-full border border-ink/10 bg-paper px-3.5 py-2 text-xs font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:border-leaf/40 hover:shadow-md"
        >
          ✨ Pick For Me
        </button>
      </div>
    </section>
  );
}

function MacroPill({ label, value, required = false }: { label: string; value: number; required?: boolean }) {
  const ok = value > 0;
  return (
    <div
      className={cn(
        "rounded-xl border px-1 py-1.5",
        ok ? "border-leaf/20 bg-leaf/8" : "border-ink/8 bg-ink/[0.025]"
      )}
    >
      <span className={cn("block text-sm font-black tabular-nums", ok ? "text-moss" : "text-ink/30")}>
        {value}
      </span>
      <span className="block text-[9px] font-bold uppercase tracking-wide text-ink/45">
        {label}{required && !ok ? "*" : ""}
      </span>
    </div>
  );
}
