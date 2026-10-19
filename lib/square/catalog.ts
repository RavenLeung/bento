import { squareConfig } from "@/lib/config";
import type { BentoSection, CatalogItem } from "@/lib/types";
import {
  type SquareCatalogListResponse,
  type SquareCatalogObject,
  type SquareCustomAttributeDefinition,
  type SquareCustomAttributeValue
} from "@/lib/square/types";
import { squareFetch } from "@/lib/square/client";

interface MappedCatalog {
  items: CatalogItem[];
}

export async function fetchSquareCatalog(): Promise<CatalogItem[]> {
  const objects: SquareCatalogObject[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({
      types: "ITEM,CATEGORY,CUSTOM_ATTRIBUTE_DEFINITION"
    });
    if (cursor) query.set("cursor", cursor);
    const page = await squareFetch<SquareCatalogListResponse>(
      `/v2/catalog/list?${query.toString()}`
    );
    objects.push(...(page.objects ?? []));
    cursor = page.cursor;
  } while (cursor);

  return mapSquareCatalog(objects, squareConfig.locationId, squareConfig.categories);
}

type CategoryConfig = {
  box: string;
  protein: string;
  vegetable: string;
  starch: string;
};

export function mapSquareCatalog(
  objects: SquareCatalogObject[],
  locationId: string,
  categories: CategoryConfig
): CatalogItem[] {
  const categoryNames = new Map<string, string>();
  const definitions = new Map<string, SquareCustomAttributeDefinition>();

  for (const object of objects) {
    if (object.type === "CATEGORY" && object.category_data?.name) {
      categoryNames.set(object.id, object.category_data.name.toLowerCase());
    }
    if (object.type === "CUSTOM_ATTRIBUTE_DEFINITION") {
      definitions.set(object.id, {
        id: object.id,
        custom_attribute_definition_data: object.custom_attribute_definition_data
      });
    }
  }

  const definitionIdByKey = new Map<string, string>();
  const selectionNames = new Map<string, Map<string, string>>();
  for (const definition of definitions.values()) {
    const key = definition.custom_attribute_definition_data?.key;
    if (!key) continue;
    definitionIdByKey.set(key, definition.id);
    const selections = new Map<string, string>();
    for (const selection of definition.custom_attribute_definition_data?.selection_config?.allowed_selections ?? []) {
      selections.set(selection.uid, selection.name);
    }
    selectionNames.set(key, selections);
  }

  const resolvedCategories = {
    box: categories.box || findCategoryId(categoryNames, ["bento box", "bento boxes", "boxes"]),
    protein: categories.protein || findCategoryId(categoryNames, ["protein", "proteins"]),
    vegetable: categories.vegetable || findCategoryId(categoryNames, ["vegetable", "vegetables", "veg"]),
    starch: categories.starch || findCategoryId(categoryNames, ["starch", "starches", "carbs"])
  };

  const items: CatalogItem[] = [];
  for (const object of objects) {
    if (object.type !== "ITEM" || !object.item_data) continue;
    const section = sectionForCategory(object.item_data.category_id, resolvedCategories);
    if (!section) continue;
    if (isAbsentAtLocation(object, locationId)) continue;

    const variations = object.item_data.variations ?? [];
    for (const variation of variations) {
      const variationData = variation.item_variation_data;
      if (!variationData) continue;
      const override = variationData.location_overrides?.find(
        (entry) => entry.location_id === locationId
      );
      const soldOut =
        Boolean(override?.sold_out) ||
        Boolean(variationData.sold_out) ||
        Boolean(variationData.absent_at_location_ids?.includes(locationId));

      const displayOrder = getNumberAttribute(
        object.item_data.custom_attribute_values,
        definitionIdByKey.get("builder_order")
      );
      const capacity = getNumberAttribute(
        object.item_data.custom_attribute_values,
        definitionIdByKey.get("portion_capacity")
      );
      const dietaryTags = getSelectionAttribute(
        object.item_data.custom_attribute_values,
        definitionIdByKey.get("dietary_tags"),
        selectionNames.get("dietary_tags")
      );
      const allergens = getSelectionAttribute(
        object.item_data.custom_attribute_values,
        definitionIdByKey.get("allergens"),
        selectionNames.get("allergens")
      );
      const baseName = object.item_data.name || "Bento ingredient";
      const variationName = variationData.name || "Regular";
      const name = variations.length > 1 ? `${baseName} — ${variationName}` : baseName;
      const visual = inferVisual(name, section);

      items.push({
        id: variation.id,
        itemId: object.id,
        name,
        description: object.item_data.description || "",
        section,
        categoryId: object.item_data.category_id || "",
        priceCents: Math.max(0, Number(variationData.price_money?.amount ?? 0)),
        capacity:
          section === "box"
            ? capacity || inferBoxCapacity(name)
            : null,
        soldOut,
        dietaryTags,
        allergens,
        displayOrder: displayOrder || inferDisplayOrder(name),
        imageUrl: null,
        emoji: visual.emoji,
        color: visual.color
      });
    }
  }

  return items.sort((a, b) => {
    const sectionRank: Record<BentoSection, number> = {
      box: 0,
      protein: 1,
      vegetable: 2,
      starch: 3
    };
    const rank = sectionRank[a.section] - sectionRank[b.section];
    if (rank !== 0) return rank;
    return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);
  });
}

function findCategoryId(categoryNames: Map<string, string>, names: string[]): string {
  for (const [id, name] of categoryNames) {
    if (names.some((candidate) => name === candidate || name.includes(candidate))) return id;
  }
  return "";
}

function sectionForCategory(
  categoryId: string | undefined,
  categories: CategoryConfig
): BentoSection | null {
  if (!categoryId) return null;
  if (categoryId === categories.box) return "box";
  if (categoryId === categories.protein) return "protein";
  if (categoryId === categories.vegetable) return "vegetable";
  if (categoryId === categories.starch) return "starch";
  return null;
}

function isAbsentAtLocation(object: SquareCatalogObject, locationId: string): boolean {
  return Boolean(object.absent_at_location_ids?.includes(locationId));
}

function getAttributeValue(
  values: Record<string, SquareCustomAttributeValue> | undefined,
  definitionId: string | undefined
): SquareCustomAttributeValue | undefined {
  if (!values || !definitionId) return undefined;
  return values[definitionId];
}

function getNumberAttribute(
  values: Record<string, SquareCustomAttributeValue> | undefined,
  definitionId: string | undefined
): number | null {
  const value = getAttributeValue(values, definitionId)?.number_value;
  const number = value ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function getSelectionAttribute(
  values: Record<string, SquareCustomAttributeValue> | undefined,
  definitionId: string | undefined,
  names: Map<string, string> | undefined
): string[] {
  const raw = getAttributeValue(values, definitionId)?.selection_uid_values ?? [];
  return raw.map((uid) => names?.get(uid) ?? uid).filter(Boolean);
}

function inferBoxCapacity(name: string): number {
  return /large|big|family|10/i.test(name) ? 10 : 6;
}

function inferDisplayOrder(name: string): number {
  return name.length % 17;
}

export function inferVisual(name: string, section: BentoSection): { emoji: string; color: string } {
  const value = name.toLowerCase();
  if (/salmon|fish/.test(value)) return { emoji: "🐟", color: "#f28b72" };
  if (/tuna/.test(value)) return { emoji: "🐠", color: "#e97f74" };
  if (/beef|steak/.test(value)) return { emoji: "🥩", color: "#c9553d" };
  if (/chicken/.test(value)) return { emoji: "🍗", color: "#e8a44e" };
  if (/tofu/.test(value)) return { emoji: "🧈", color: "#ead8b5" };
  if (/egg|tamago/.test(value)) return { emoji: "🥚", color: "#f4c95d" };
  if (/prawn|shrimp/.test(value)) return { emoji: "🍤", color: "#ef8f73" };
  if (/broccoli/.test(value)) return { emoji: "🥦", color: "#4f8a5b" };
  if (/avocado/.test(value)) return { emoji: "🥑", color: "#7aaa61" };
  if (/edamame|bean/.test(value)) return { emoji: "🫛", color: "#76a95f" };
  if (/cucumber/.test(value)) return { emoji: "🥒", color: "#9cc47b" };
  if (/carrot/.test(value)) return { emoji: "🥕", color: "#ef9b45" };
  if (/mushroom|shiitake/.test(value)) return { emoji: "🍄", color: "#9d7658" };
  if (/corn/.test(value)) return { emoji: "🌽", color: "#f0c54e" };
  if (/rice/.test(value)) return { emoji: "🍚", color: "#f1ead9" };
  if (/noodle|soba/.test(value)) return { emoji: "🍜", color: "#b59b6b" };
  if (/potato/.test(value)) return { emoji: "🍠", color: "#dd8b5b" };
  if (section === "box") return { emoji: "🍱", color: "#f4c95d" };
  return { emoji: section === "protein" ? "🍥" : "🥢", color: "#d9c9a5" };
}
