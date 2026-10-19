import type { CatalogItem } from "@/lib/types";

function item(
  id: string,
  name: string,
  section: CatalogItem["section"],
  priceCents: number,
  description: string,
  emoji: string,
  color: string,
  dietaryTags: string[],
  allergens: string[],
  options: { capacity?: number; displayOrder?: number } = {}
): CatalogItem {
  return {
    id,
    itemId: id,
    name,
    description,
    section,
    categoryId: `demo-${section}`,
    priceCents,
    capacity: options.capacity ?? null,
    soldOut: false,
    dietaryTags,
    allergens,
    displayOrder: options.displayOrder ?? 0,
    imageUrl: null,
    emoji,
    color
  };
}

export const DEMO_CATALOG: CatalogItem[] = [
  item("demo-box-regular", "Regular Bento", "box", 0, "A six-slot box for a focused lunch.", "🍱", "#f4c95d", [], [], { capacity: 6, displayOrder: 0 }),
  item("demo-box-large", "Large Bento", "box", 0, "Ten slots for a proper feast.", "🧺", "#f28b72", [], [], { capacity: 10, displayOrder: 1 }),

  item("protein-salmon", "Miso Salmon", "protein", 750, "Caramelised miso glaze, flaked and ready.", "🐟", "#f28b72", ["high-protein", "gluten-free"], ["fish", "soy"], { displayOrder: 0 }),
  item("protein-beef", "Soy Beef", "protein", 700, "Tender sliced beef with a savoury soy glaze.", "🥩", "#c9553d", ["high-protein"], ["soy", "sesame"], { displayOrder: 1 }),
  item("protein-chicken", "Teriyaki Chicken", "protein", 600, "Charred chicken thigh, teriyaki glaze.", "🍗", "#e8a44e", ["high-protein"], ["soy", "sesame"], { displayOrder: 2 }),
  item("protein-tofu", "Crispy Tofu", "protein", 550, "Golden tofu with sesame and spring onion.", "🧈", "#ead8b5", ["vegetarian", "vegan", "high-protein"], ["soy", "sesame"], { displayOrder: 3 }),
  item("protein-egg", "Tamagoyaki", "protein", 350, "Soft rolled egg with a touch of mirin.", "🥚", "#f4c95d", ["vegetarian", "gluten-free"], ["egg"], { displayOrder: 4 }),
  item("protein-prawn", "Garlic Prawns", "protein", 800, "Prawns tossed in garlic butter and yuzu.", "🍤", "#ef8f73", ["high-protein", "gluten-free"], ["shellfish", "milk"], { displayOrder: 5 }),

  item("veg-broccoli", "Charred Broccoli", "vegetable", 250, "Blistered broccoli with sesame salt.", "🥦", "#4f8a5b", ["vegetarian", "vegan", "gluten-free"], ["sesame"], { displayOrder: 0 }),
  item("veg-avocado", "Avocado", "vegetable", 300, "Creamy avocado with lime and shiso.", "🥑", "#7aaa61", ["vegetarian", "vegan", "gluten-free"], [], { displayOrder: 1 }),
  item("veg-edamame", "Edamame", "vegetable", 250, "Steamed edamame with sea salt.", "🫛", "#76a95f", ["vegetarian", "vegan", "high-protein"], ["soy"], { displayOrder: 2 }),
  item("veg-cucumber", "Pickled Cucumber", "vegetable", 200, "Crunchy cucumber, rice vinegar, chilli.", "🥒", "#9cc47b", ["vegetarian", "vegan", "gluten-free"], [], { displayOrder: 3 }),
  item("veg-carrot", "Kinpira Carrot", "vegetable", 200, "Carrot ribbons with sesame and ginger.", "🥕", "#ef9b45", ["vegetarian", "vegan", "gluten-free"], ["sesame"], { displayOrder: 4 }),
  item("veg-mushroom", "Shiitake", "vegetable", 250, "Butter-soy shiitake mushrooms.", "🍄", "#9d7658", ["vegetarian", "gluten-free"], ["soy", "milk"], { displayOrder: 5 }),
  item("veg-corn", "Sweetcorn", "vegetable", 200, "Charred corn with chilli lime butter.", "🌽", "#f0c54e", ["vegetarian", "gluten-free"], ["milk"], { displayOrder: 6 }),

  item("starch-rice", "Sushi Rice", "starch", 250, "Seasoned Japanese rice.", "🍚", "#f1ead9", ["vegetarian", "vegan", "gluten-free"], [], { displayOrder: 0 }),
  item("starch-brown-rice", "Brown Rice", "starch", 280, "Nutty brown rice with furikake.", "🌾", "#d7bf8f", ["vegetarian", "vegan", "gluten-free"], ["sesame"], { displayOrder: 1 }),
  item("starch-soba", "Soba Noodles", "starch", 300, "Chilled soba with a light soy dressing.", "🍜", "#b59b6b", ["vegetarian", "vegan"], ["gluten", "soy"], { displayOrder: 2 }),
  item("starch-sweet-potato", "Roast Sweet Potato", "starch", 300, "Caramelised sweet potato wedges.", "🍠", "#dd8b5b", ["vegetarian", "vegan", "gluten-free"], [], { displayOrder: 3 })
];
