"use client";

import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ItemImage } from "@/components/bento/ItemImage";
import {
  TOUCH_DRAG_TOLERANCE_PX,
  TOUCH_PRESS_FEEDBACK_MS,
  type MenuDragData
} from "@/lib/bento-dnd";
import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

interface IngredientCardProps {
  item: CatalogItem;
  quantity: number;
  onAdd: (item: CatalogItem) => void;
  onRemove: (item: CatalogItem) => void;
}

const DIETARY_BADGE_STYLES: Record<string, string> = {
  vegetarian: "bg-leaf/10 text-moss ring-leaf/20",
  vegan: "bg-moss/10 text-moss ring-moss/20",
  "gluten-free": "bg-yuzu/20 text-ink/65 ring-yuzu/40",
  "high-protein": "bg-salmon/15 text-chili ring-salmon/25"
};

export function IngredientCard({ item, quantity, onAdd, onRemove }: IngredientCardProps) {
  const [isPressing, setIsPressing] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const selected = quantity > 0;
  const allergenCopy =
    item.allergens.length > 0 ? `Contains ${item.allergens.join(", ")}` : "No listed allergens";
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `menu-drag-${item.id}`,
    data: { item } satisfies MenuDragData,
    disabled: item.soldOut
  });
  const dragPointerDown = listeners?.onPointerDown;

  useEffect(() => {
    return () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    };
  }, []);

  function cancelPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
    setIsPressing(false);
  }

  function startPress(event: ReactPointerEvent<HTMLElement>) {
    if (item.soldOut || event.pointerType === "mouse" || !event.isPrimary) return;
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      setIsPressing(true);
    }, TOUCH_PRESS_FEEDBACK_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" || !pressOrigin.current) return;
    const deltaX = event.clientX - pressOrigin.current.x;
    const deltaY = event.clientY - pressOrigin.current.y;
    if (Math.hypot(deltaX, deltaY) > TOUCH_DRAG_TOLERANCE_PX) cancelPress();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    startPress(event);
    dragPointerDown?.(event);
  }

  return (
    <article
      ref={setNodeRef}
      data-testid={`menu-drag-${item.id}`}
      data-dragging={isDragging ? "true" : undefined}
      data-pressing={isPressing ? "true" : undefined}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "group relative flex min-h-[8.25rem] touch-manipulation select-none items-stretch gap-3.5 overflow-hidden rounded-[1.35rem] border bg-paper p-3 transition duration-200 [-webkit-touch-callout:none] sm:p-3.5",
        !item.soldOut && "chopsticks-open-target",
        !item.soldOut && !isDragging && "lg:hover:-translate-y-0.5 lg:hover:rotate-[-0.35deg]",
        selected
          ? "border-moss/45 bg-moss/[0.035] shadow-[0_8px_24px_rgba(36,79,61,.09)] dark:shadow-none"
          : "border-ink/8 hover:border-leaf/25 hover:shadow-[0_8px_24px_rgba(28,36,31,.06)]",
        item.soldOut && "opacity-50",
        !item.soldOut && isPressing && !isDragging && "animate-press-glow scale-[0.985]",
        isDragging && "scale-[0.985] opacity-35 shadow-none"
      )}
    >
      <div
        className="relative grid h-[5.75rem] w-[5.75rem] shrink-0 place-items-center sm:h-24 sm:w-24"
        aria-hidden="true"
      >
        <ItemImage
          item={item}
          sizes="(max-width: 640px) 92px, 96px"
          className="object-contain drop-shadow-[0_8px_10px_rgba(28,36,31,0.18)] transition duration-300 group-hover:scale-105 group-hover:-rotate-2 dark:drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]"
          emojiClassName="relative text-[2.55rem] drop-shadow-sm sm:text-[3rem]"
        />
        {!item.soldOut ? (
          <span
            data-testid={`drag-handle-${item.id}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1 rounded-full border border-leaf/25 bg-paper/95 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-moss opacity-0 shadow-sm backdrop-blur transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
              (isPressing || isDragging) && "translate-y-0 opacity-100"
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1",
                (isPressing || isDragging) && "animate-drag-handle-pop"
              )}
            >
              <span className="grid grid-cols-2 gap-[2px]" aria-hidden="true">
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
                <span className="h-0.5 w-0.5 rounded-full bg-current" />
              </span>
              Drag
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-black leading-tight tracking-tight">{item.name}</h3>
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ink/50">
              {item.description}
            </p>
          </div>
          <p className="shrink-0 text-sm font-extrabold tabular-nums">
            {formatMoney(item.priceCents)}
          </p>
        </div>

        {item.dietaryTags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.dietaryTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ring-1",
                  DIETARY_BADGE_STYLES[tag] ?? "bg-ink/5 text-ink/50 ring-ink/10"
                )}
              >
                {tag.replace("-", " ")}
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-1.5 truncate text-[9px] font-semibold leading-4 text-ink/38" title={allergenCopy}>
          {allergenCopy}
        </p>

        <div
          className="mt-auto flex items-center justify-end gap-2 pt-2"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          {item.soldOut ? (
            <span className="rounded-full bg-ink/8 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-ink/45">
              Sold out
            </span>
          ) : quantity === 0 ? (
            <button
              type="button"
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              data-testid={`add-${item.id}`}
              className="h-10 shrink-0 rounded-full bg-moss px-4 text-xs font-black text-white shadow-sm transition hover:bg-nori active:scale-95"
            >
              Add +
            </button>
          ) : (
            <div className="flex shrink-0 items-center rounded-full bg-moss p-0.5 text-white shadow-sm">
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove one ${item.name}`}
                data-testid={`remove-${item.id}`}
                className="grid h-9 w-9 place-items-center rounded-full text-base font-black transition hover:bg-white/15 active:scale-90"
              >
                −
              </button>
              <span className="min-w-4 text-center text-xs font-black tabular-nums" data-testid={`qty-${item.id}`}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onAdd(item)}
                aria-label={`Add another ${item.name}`}
                data-testid={`add-again-${item.id}`}
                className="grid h-9 w-9 place-items-center rounded-full text-base font-black transition hover:bg-white/15 active:scale-90"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
