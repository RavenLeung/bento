"use client";

import { cn, formatMoney } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

interface IngredientCardProps {
  item: CatalogItem;
  quantity: number;
  onAdd: (item: CatalogItem) => void;
  onRemove: (item: CatalogItem) => void;
}

export function IngredientCard({ item, quantity, onAdd, onRemove }: IngredientCardProps) {
  const selected = quantity > 0;
  return (
    <article
      className={cn(
        "relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-[1.35rem] border bg-paper p-3 shadow-sm transition duration-200",
        selected
          ? "border-moss/55 shadow-[0_10px_26px_rgba(36,79,61,.12)]"
          : "border-ink/8 hover:-translate-y-0.5 hover:border-leaf/30 hover:shadow-md",
        item.soldOut && "opacity-55"
      )}
      style={{ backgroundImage: `linear-gradient(145deg, ${item.color}20, transparent 54%)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[1.65rem] shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: `${item.color}75` }}
          aria-hidden="true"
        >
          {item.emoji}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {item.dietaryTags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/75 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-leaf ring-1 ring-leaf/10"
            >
              {tag.replace("-", " ")}
            </span>
          ))}
        </div>
      </div>

      <h3 className="mt-2.5 text-[15px] font-black leading-tight tracking-tight">{item.name}</h3>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink/52">{item.description}</p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold tabular-nums">{formatMoney(item.priceCents)}</p>
          {item.allergens.length > 0 ? (
            <p className="mt-0.5 truncate text-[9px] font-medium text-ink/38" title={item.allergens.join(", ")}>
              Contains {item.allergens.join(", ")}
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] font-medium text-ink/30">No listed allergens</p>
          )}
        </div>

        {item.soldOut ? (
          <span className="rounded-full bg-ink/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-ink/45">
            Sold out
          </span>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => onAdd(item)}
            aria-label={`Add ${item.name}`}
            data-testid={`add-${item.id}`}
            className="shrink-0 rounded-full bg-moss px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-nori active:scale-95"
          >
            Add +
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-moss p-0.5 text-white shadow-sm">
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remove one ${item.name}`}
              data-testid={`remove-${item.id}`}
              className="grid h-7 w-7 place-items-center rounded-full text-base font-black transition hover:bg-white/15 active:scale-90"
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
              className="grid h-7 w-7 place-items-center rounded-full text-base font-black transition hover:bg-white/15 active:scale-90"
            >
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
