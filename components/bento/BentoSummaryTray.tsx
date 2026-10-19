"use client";

import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";
import type { BoardPortion } from "./BentoBoard";

interface BentoSummaryTrayProps {
  box: CatalogItem;
  portions: BoardPortion[];
  capacity: number;
  totalCents: number;
  valid: boolean;
  proteinCount: number;
  vegetableCount: number;
  currency: string;
  onOpen: () => void;
  onCheckout: () => void;
}

export function BentoSummaryTray({
  box,
  portions,
  capacity,
  totalCents,
  valid,
  proteinCount,
  vegetableCount,
  currency,
  onOpen,
  onCheckout
}: BentoSummaryTrayProps) {
  const status =
    proteinCount < 1 && vegetableCount < 1
      ? "Add a protein + vegetable"
      : proteinCount < 1
        ? "Add a protein"
        : vegetableCount < 1
          ? "Add a vegetable"
          : portions.length >= capacity
            ? "Every slot filled"
            : "Looking good";

  return (
    <div data-testid="bento-tray" className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="mx-auto max-w-xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="overflow-hidden rounded-[1.4rem] border border-ink/10 bg-paper/95 shadow-[0_-10px_34px_rgba(28,36,31,.16)] backdrop-blur-md">
          <button
            type="button"
            data-testid="open-bento-board"
            onClick={onOpen}
            aria-label={`Open bento board, ${portions.length} of ${capacity} portions filled`}
            className="flex w-full items-center gap-3 px-3 pt-2.5 text-left"
          >
            <div
              className={cn("grid shrink-0 gap-1", capacity >= 10 ? "grid-cols-5" : "grid-cols-3")}
              aria-hidden="true"
            >
              {Array.from({ length: capacity }).map((_, index) => {
                const portion = portions[index];
                return (
                  <span
                    key={portion?.key ?? `empty-${index}`}
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-[0.35rem] text-[0.55rem] leading-none",
                      portion
                        ? "ring-1 ring-black/5"
                        : "checker border border-dashed border-ink/10 bg-white/40"
                    )}
                    style={portion ? { backgroundColor: `${portion.item.color}66` } : undefined}
                  >
                    {portion?.item.emoji ?? ""}
                  </span>
                );
              })}
            </div>

            <div data-testid="bento-summary" className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-leaf">Your bento</p>
                <span
                  data-testid="tray-fill-count"
                  className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-ink/50"
                >
                  {portions.length}/{capacity}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[13px] font-black leading-tight">{box.name}</p>
              <p className={cn("truncate text-[10px] font-semibold", valid ? "text-leaf" : "text-ink/45")}>
                {status}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p data-testid="tray-total" className="font-display text-lg font-black leading-none tabular-nums">
                {formatMoney(totalCents, currency)}
              </p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-wide text-ink/35">Tap to edit</p>
            </div>
          </button>

          <div className="flex items-center gap-3 px-3 pb-2.5 pt-2">
            <p className="min-w-0 flex-1 truncate text-[9px] font-bold text-ink/40">
              Free box · GST included
            </p>
            <button
              type="button"
              onClick={onCheckout}
              disabled={!valid}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition",
                valid
                  ? "bg-moss text-white shadow-md active:scale-[0.98]"
                  : "cursor-not-allowed bg-ink/10 text-ink/35"
              )}
            >
              Review & pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
