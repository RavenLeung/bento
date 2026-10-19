"use client";

import { ItemImage } from "@/components/bento/ItemImage";
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
  const selected = quantity > 0;
  const allergenCopy =
    item.allergens.length > 0 ? `Contains ${item.allergens.join(", ")}` : "No listed allergens";

  return (
    <article
      className={cn(
        "group relative flex min-h-[8.25rem] items-stretch gap-3.5 overflow-hidden rounded-[1.35rem] border bg-paper p-3 transition duration-200 sm:p-3.5",
        selected
          ? "border-moss/45 bg-moss/[0.035] shadow-[0_8px_24px_rgba(36,79,61,.09)] dark:shadow-none"
          : "border-ink/8 hover:border-leaf/25 hover:shadow-[0_8px_24px_rgba(28,36,31,.06)]",
        item.soldOut && "opacity-50"
      )}
    >
      <div
        className="relative grid h-[5.75rem] w-[5.75rem] shrink-0 place-items-center overflow-hidden rounded-[1.25rem] bg-ink/5 ring-1 ring-black/5 dark:ring-white/10 sm:h-24 sm:w-24"
        style={{ backgroundColor: `${item.color}24` }}
        aria-hidden="true"
      >
        <span className="checker absolute inset-0 opacity-25" />
        <ItemImage
          item={item}
          sizes="(max-width: 640px) 92px, 96px"
          className="transition duration-300 group-hover:scale-105"
          emojiClassName="relative text-[2.55rem] drop-shadow-sm sm:text-[3rem]"
        />
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

        <div className="mt-auto flex items-center justify-end gap-2 pt-2">
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
