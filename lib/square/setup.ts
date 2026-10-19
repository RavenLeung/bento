import { squareFetch } from "@/lib/square/client";
import type {
  SquareCatalogListResponse,
  SquareCatalogObject
} from "@/lib/square/types";

export interface SetupResult {
  categories: Record<"box" | "protein" | "vegetable" | "starch", { id: string; name: string }>;
  attributes: Record<string, string>;
  created: number;
  selectionValuesAdded: number;
}

const CATEGORY_NAMES = {
  box: "Bento Boxes",
  protein: "Proteins",
  vegetable: "Vegetables",
  starch: "Starches"
} as const;

const DIETARY_VALUES = ["vegetarian", "vegan", "gluten-free", "high-protein"];
const ALLERGEN_VALUES = ["fish", "shellfish", "egg", "milk", "soy", "sesame", "gluten", "nuts"];

export async function bootstrapSquareCatalog(): Promise<SetupResult> {
  const before = await listSetupObjects();
  const categoriesBefore = findCategories(before);
  const definitionsBefore = new Map(
    before
      .filter((object) => object.type === "CUSTOM_ATTRIBUTE_DEFINITION")
      .map((object) => [object.custom_attribute_definition_data?.key, object])
  );

  const objects: Array<Record<string, unknown>> = [];
  let selectionValuesAdded = 0;
  for (const [section, name] of Object.entries(CATEGORY_NAMES) as Array<
    [keyof typeof CATEGORY_NAMES, string]
  >) {
    if (!categoriesBefore[section]) {
      objects.push({
        type: "CATEGORY",
        id: `#category-${section}`,
        present_at_all_locations: true,
        category_data: { name }
      });
    }
  }

  if (!definitionsBefore.has("builder_order")) {
    objects.push(numberDefinition("#definition-builder-order", "builder_order", "Builder order"));
  }
  if (!definitionsBefore.has("portion_capacity")) {
    objects.push(numberDefinition("#definition-portion-capacity", "portion_capacity", "Portion capacity"));
  }
  const dietaryDefinition = definitionsBefore.get("dietary_tags");
  if (!dietaryDefinition) {
    objects.push(selectionDefinition("#definition-dietary-tags", "dietary_tags", "Dietary tags", DIETARY_VALUES));
  } else {
    selectionValuesAdded += addMissingSelectionValues(
      objects,
      dietaryDefinition,
      "dietary_tags",
      "Dietary tags",
      DIETARY_VALUES
    );
  }
  const allergenDefinition = definitionsBefore.get("allergens");
  if (!allergenDefinition) {
    objects.push(selectionDefinition("#definition-allergens", "allergens", "Allergens", ALLERGEN_VALUES));
  } else {
    selectionValuesAdded += addMissingSelectionValues(
      objects,
      allergenDefinition,
      "allergens",
      "Allergens",
      ALLERGEN_VALUES
    );
  }

  if (objects.length > 0) {
    await squareFetch("/v2/catalog/batch-upsert", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        batches: [{ objects }]
      })
    });
  }

  const after = await listSetupObjects();
  const categories = findCategories(after);
  const attributes = new Map(
    after
      .filter((object) => object.type === "CUSTOM_ATTRIBUTE_DEFINITION")
      .map((object) => [object.custom_attribute_definition_data?.key, object.id])
  );

  const missingCategories = (Object.keys(CATEGORY_NAMES) as Array<keyof typeof CATEGORY_NAMES>).filter(
    (section) => !categories[section]
  );
  if (missingCategories.length > 0) {
    throw new Error(`Square did not return categories: ${missingCategories.join(", ")}`);
  }

  return {
    categories: categories as SetupResult["categories"],
    attributes: {
      builder_order: attributes.get("builder_order") ?? "",
      portion_capacity: attributes.get("portion_capacity") ?? "",
      dietary_tags: attributes.get("dietary_tags") ?? "",
      allergens: attributes.get("allergens") ?? ""
    },
    created: objects.length,
    selectionValuesAdded
  };
}

export async function listSetupObjects(): Promise<SquareCatalogObject[]> {
  const objects: SquareCatalogObject[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ types: "CATEGORY,CUSTOM_ATTRIBUTE_DEFINITION" });
    if (cursor) query.set("cursor", cursor);
    const page = await squareFetch<SquareCatalogListResponse>(`/v2/catalog/list?${query.toString()}`);
    objects.push(...(page.objects ?? []));
    cursor = page.cursor;
  } while (cursor);
  return objects;
}

function findCategories(objects: SquareCatalogObject[]) {
  const result: Partial<SetupResult["categories"]> = {};
  for (const object of objects) {
    if (object.type !== "CATEGORY") continue;
    const name = object.category_data?.name;
    if (!name) continue;
    for (const [section, expected] of Object.entries(CATEGORY_NAMES) as Array<
      [keyof typeof CATEGORY_NAMES, string]
    >) {
      if (name.trim().toLowerCase() === expected.toLowerCase()) {
        result[section] = { id: object.id, name };
      }
    }
  }
  return result;
}

function numberDefinition(id: string, key: string, name: string) {
  return {
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    id,
    custom_attribute_definition_data: {
      key,
      name,
      description: "Managed by the Bento Lab ordering app.",
      type: "NUMBER",
      seller_visibility: "SELLER_VISIBILITY_READ_WRITE_VALUES"
    }
  };
}

function selectionDefinition(id: string, key: string, name: string, values: string[]) {
  return {
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    id,
    custom_attribute_definition_data: {
      key,
      name,
      description: "Managed by the Bento Lab ordering app.",
      type: "SELECTION",
      seller_visibility: "SELLER_VISIBILITY_READ_WRITE_VALUES",
      selection_config: {
        max_allowed_selections: values.length,
        allowed_selections: values.map((value) => ({
          name: value
        }))
      }
    }
  };
}

function addMissingSelectionValues(
  objects: Array<Record<string, unknown>>,
  definition: SquareCatalogObject,
  key: string,
  name: string,
  requiredValues: string[]
): number {
  const data = definition.custom_attribute_definition_data;
  const existingSelections = data?.selection_config?.allowed_selections ?? [];
  const existingNames = new Set(existingSelections.map((selection) => selection.name.toLowerCase()));
  const missing = requiredValues.filter((value) => !existingNames.has(value.toLowerCase()));
  if (missing.length === 0) return 0;

  objects.push({
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    id: definition.id,
    custom_attribute_definition_data: {
      key: data?.key ?? key,
      name: data?.name ?? name,
      description: data?.description ?? "Managed by the Bento Lab ordering app.",
      type: "SELECTION",
      seller_visibility: data?.seller_visibility ?? "SELLER_VISIBILITY_READ_WRITE_VALUES",
      selection_config: {
        max_allowed_selections: Math.max(
          existingSelections.length + missing.length,
          data?.selection_config?.max_allowed_selections ?? 0
        ),
        allowed_selections: [
          ...existingSelections.map((selection) => ({ uid: selection.uid, name: selection.name })),
          ...missing.map((value) => ({ name: value }))
        ]
      }
    }
  });
  return missing.length;
}
