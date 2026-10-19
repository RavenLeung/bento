"use client";

import { useEffect, useRef } from "react";
import { BentoBoard, type BoardPortion } from "@/components/bento/BentoBoard";
import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

interface BentoSheetProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  boxes: CatalogItem[];
  activeBoxId: string;
  onSelectBox: (id: string) => void;
  box: CatalogItem;
  portions: BoardPortion[];
  saucePortions: BoardPortion[];
  totalCents: number;
  proteinCount: number;
  vegetableCount: number;
  starchCount: number;
  totalPortions: number;
  valid: boolean;
  currency: string;
  onRemove: (item: CatalogItem) => void;
  onClear: () => void;
  onChefPick: () => void;
}

export function BentoSheet({
  open,
  onClose,
  onCheckout,
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
  valid,
  currency,
  onRemove,
  onClear,
  onChefPick
}: BentoSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButton.current?.focus(), 60);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus({ preventScroll: true });
      previouslyFocused.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="animate-fade-in absolute inset-0 bg-nori/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bento-sheet-title"
        className="animate-slide-up absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[2rem] bg-rice shadow-lift"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/8 bg-rice/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-leaf">Your bento</p>
            <h2 id="bento-sheet-title" className="font-display text-lg font-black tracking-tight">
              Build your box
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close bento board"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-lg font-black text-ink/55 transition hover:bg-ink/10 hover:text-ink active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="px-3 pb-24 pt-3">
          <BentoBoard
            boxes={boxes}
            activeBoxId={activeBoxId}
            onSelectBox={onSelectBox}
            box={box}
            portions={portions}
            saucePortions={saucePortions}
            totalCents={totalCents}
            proteinCount={proteinCount}
            vegetableCount={vegetableCount}
            starchCount={starchCount}
            totalPortions={totalPortions}
            onRemove={onRemove}
            onClear={onClear}
            onChefPick={onChefPick}
          />
        </div>

        <div className="safe-bottom sticky bottom-0 z-10 flex items-center gap-3 border-t border-ink/8 bg-rice/95 px-4 pt-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-ink/35">Total</p>
            <p className="font-display text-xl font-black leading-tight tabular-nums">
              {formatMoney(totalCents, currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCheckout}
            disabled={!valid}
            className={cn(
              "shrink-0 rounded-xl px-5 py-3 text-sm font-black transition",
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
  );
}
