import { AppError, type CatalogItem, type QuoteDraft, type QuoteSelection } from "@/lib/types";
import {
  MAX_SAUCE_PORTIONS,
  MIN_PROTEIN_PORTIONS,
  MIN_VEGETABLE_PORTIONS
} from "@/lib/bento-rules";

const SECTION_ORDER: Record<"protein" | "vegetable" | "starch" | "sauce", number> = {
  protein: 0,
  vegetable: 1,
  starch: 2,
  sauce: 3
};

export interface QuoteInput {
  boxItemId: string;
  selections: QuoteSelection[];
  catalog: CatalogItem[];
  currency: string;
}

export function buildQuote({ boxItemId, selections, catalog, currency }: QuoteInput): QuoteDraft {
  const box = catalog.find((item) => item.id === boxItemId && item.section === "box");
  if (!box) {
    throw new AppError("BAD_REQUEST", "Choose a valid bento box.");
  }
  if (box.soldOut) {
    throw new AppError("OUT_OF_STOCK", `${box.name} is sold out.`, 409);
  }
  if (!box.capacity || box.capacity < 1) {
    throw new AppError("BAD_REQUEST", "This box has no configured capacity.");
  }

  const byId = new Map(catalog.map((item) => [item.id, item]));
  const normalized = new Map<string, number>();

  for (const selection of selections) {
    if (!Number.isInteger(selection.quantity) || selection.quantity <= 0) {
      throw new AppError("BAD_REQUEST", "Ingredient quantities must be positive whole numbers.");
    }
    normalized.set(selection.itemId, (normalized.get(selection.itemId) ?? 0) + selection.quantity);
  }

  let totalPortions = 0;
  let saucePortions = 0;
  let proteinPortions = 0;
  let vegetablePortions = 0;
  const lines = [];

  for (const [itemId, quantity] of normalized) {
    const item = byId.get(itemId);
    if (!item || item.section === "box") {
      throw new AppError("BAD_REQUEST", "One of the selected ingredients is unavailable.");
    }
    if (item.soldOut) {
      throw new AppError("OUT_OF_STOCK", `${item.name} is sold out.`, 409);
    }
    if (item.section === "sauce") saucePortions += quantity;
    else totalPortions += quantity;
    if (item.section === "protein") proteinPortions += quantity;
    if (item.section === "vegetable") vegetablePortions += quantity;

    lines.push({
      itemId: item.id,
      name: item.name,
      section: item.section,
      unitPriceCents: item.priceCents,
      quantity,
      lineTotalCents: item.priceCents * quantity,
      dietaryTags: [...item.dietaryTags],
      allergens: [...item.allergens]
    });
  }

  if (totalPortions === 0) {
    throw new AppError("MINIMUM_NOT_MET", "Add at least one protein and one vegetable.");
  }
  if (totalPortions > box.capacity) {
    throw new AppError(
      "CAPACITY_EXCEEDED",
      `${box.name} fits ${box.capacity} portions. Remove ${totalPortions - box.capacity}.`,
      409
    );
  }
  if (saucePortions > MAX_SAUCE_PORTIONS) {
    throw new AppError(
      "SAUCE_LIMIT_EXCEEDED",
      `Choose up to ${MAX_SAUCE_PORTIONS} sauces. Remove ${saucePortions - MAX_SAUCE_PORTIONS}.`,
      409
    );
  }
  if (proteinPortions < MIN_PROTEIN_PORTIONS || vegetablePortions < MIN_VEGETABLE_PORTIONS) {
    throw new AppError(
      "MINIMUM_NOT_MET",
      "Every bento needs at least one protein and one vegetable. Starch and sauce are optional.",
      409
    );
  }

  lines.sort((a, b) => {
    const sectionDiff = SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
    if (sectionDiff !== 0) return sectionDiff;
    return a.name.localeCompare(b.name);
  });

  return {
    boxItemId: box.id,
    boxName: box.name,
    boxCapacity: box.capacity,
    selections: [...normalized.entries()].map(([itemId, quantity]) => ({ itemId, quantity })),
    lines,
    totalCents: lines.reduce((total, line) => total + line.lineTotalCents, 0),
    currency,
    totalPortions
  };
}
