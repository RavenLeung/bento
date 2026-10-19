import { describe, expect, it } from "vitest";
import { mapSquareCatalog } from "@/lib/square/catalog";
import type { SquareCatalogObject } from "@/lib/square/types";

const categories = {
  box: "cat-box",
  protein: "cat-protein",
  vegetable: "cat-vegetable",
  starch: "cat-starch",
  sauce: "cat-sauce"
};

const objects: SquareCatalogObject[] = [
  {
    id: "cat-box",
    type: "CATEGORY",
    category_data: { name: "Bento Boxes" }
  },
  {
    id: "cat-protein",
    type: "CATEGORY",
    category_data: { name: "Proteins" }
  },
  {
    id: "cat-sauce",
    type: "CATEGORY",
    category_data: { name: "Sauces" }
  },
  {
    id: "def-order",
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    custom_attribute_definition_data: {
      key: "builder_order",
      name: "Builder order",
      type: "NUMBER"
    }
  },
  {
    id: "def-capacity",
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    custom_attribute_definition_data: {
      key: "portion_capacity",
      name: "Portion capacity",
      type: "NUMBER"
    }
  },
  {
    id: "def-diet",
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    custom_attribute_definition_data: {
      key: "dietary_tags",
      name: "Dietary tags",
      type: "SELECTION",
      selection_config: {
        allowed_selections: [
          { uid: "diet-veg", name: "vegetarian" },
          { uid: "diet-gf", name: "gluten-free" }
        ]
      }
    }
  },
  {
    id: "def-allergen",
    type: "CUSTOM_ATTRIBUTE_DEFINITION",
    custom_attribute_definition_data: {
      key: "allergens",
      name: "Allergens",
      type: "SELECTION",
      selection_config: {
        allowed_selections: [{ uid: "allergen-soy", name: "soy" }]
      }
    }
  },
  {
    id: "item-box",
    type: "ITEM",
    item_data: {
      name: "Regular Bento",
      category_id: "cat-box",
      custom_attribute_values: {
        "def-order": { number_value: "1" },
        "def-capacity": { number_value: "6" }
      },
      variations: [
        {
          id: "var-box",
          item_variation_data: {
            name: "Regular",
            price_money: { amount: 0, currency: "AUD" }
          }
        }
      ]
    }
  },
  {
    id: "item-tofu",
    type: "ITEM",
    item_data: {
      name: "Crispy Tofu",
      description: "Golden tofu",
      category_id: "cat-protein",
      custom_attribute_values: {
        "def-diet": { selection_uid_values: ["diet-veg", "diet-gf"] },
        "def-allergen": { selection_uid_values: ["allergen-soy"] }
      },
      variations: [
        {
          id: "var-tofu-regular",
          item_variation_data: {
            name: "Regular",
            price_money: { amount: 550, currency: "AUD" }
          }
        },
        {
          id: "var-tofu-large",
          item_variation_data: {
            name: "Large",
            price_money: { amount: 850, currency: "AUD" },
            location_overrides: [{ location_id: "loc-1", sold_out: true }]
          }
        }
      ]
    }
  },
  {
    id: "item-large-box",
    type: "ITEM",
    item_data: {
      name: "Large Bento",
      category_id: "cat-box",
      variations: [
        {
          id: "var-large-box",
          item_variation_data: {
            name: "Large",
            price_money: { amount: 0, currency: "AUD" }
          }
        }
      ]
    }
  },
  {
    id: "item-curry",
    type: "ITEM",
    item_data: {
      name: "Yellow Curry",
      category_id: "cat-sauce",
      variations: [
        {
          id: "var-curry",
          item_variation_data: {
            price_money: { amount: 300, currency: "AUD" }
          }
        }
      ]
    }
  },
  {
    id: "item-absent",
    type: "ITEM",
    absent_at_location_ids: ["loc-1"],
    item_data: {
      name: "Hidden Protein",
      category_id: "cat-protein",
      variations: [
        {
          id: "var-absent",
          item_variation_data: { price_money: { amount: 600, currency: "AUD" } }
        }
      ]
    }
  },
  {
    id: "item-other",
    type: "ITEM",
    item_data: {
      name: "Not a bento item",
      category_id: "another-category",
      variations: [
        {
          id: "var-other",
          item_variation_data: { price_money: { amount: 100, currency: "AUD" } }
        }
      ]
    }
  }
];

describe("mapSquareCatalog", () => {
  const items = mapSquareCatalog(objects, "loc-1", categories);

  it("maps categories, custom attributes and prices", () => {
    const box = items.find((item) => item.id === "var-box");
    expect(box).toMatchObject({ section: "box", capacity: 6, priceCents: 0 });

    const largeBox = items.find((item) => item.id === "var-large-box");
    expect(largeBox).toMatchObject({ section: "box", capacity: 9 });

    const tofu = items.find((item) => item.id === "var-tofu-regular");
    expect(tofu).toMatchObject({
      name: "Crispy Tofu — Regular",
      priceCents: 550,
      dietaryTags: ["vegetarian", "gluten-free"],
      allergens: ["soy"]
    });

    const curry = items.find((item) => item.id === "var-curry");
    expect(curry).toMatchObject({ section: "sauce", priceCents: 300 });
  });

  it("reads sold-out overrides and hides absent items", () => {
    expect(items.find((item) => item.id === "var-tofu-large")?.soldOut).toBe(true);
    expect(items.some((item) => item.id === "var-absent")).toBe(false);
  });

  it("ignores items outside the five bento categories", () => {
    expect(items.some((item) => item.id === "var-other")).toBe(false);
  });

  it("sorts boxes before ingredients and sauces after dishes", () => {
    expect(items[0]?.section).toBe("box");
    expect(items.findIndex((item) => item.section === "sauce")).toBeGreaterThan(
      items.findIndex((item) => item.section === "protein")
    );
  });
});
