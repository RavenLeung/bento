import type { BentoSection, CatalogItem } from "@/lib/types";

const PHOTO_BASE = "https://www.ja2square.com.au/images/thumbs/";

function photo(file: string): string {
  return `${PHOTO_BASE}${file}`;
}

interface DemoItemInput {
  id: string;
  name: string;
  section: BentoSection;
  priceCents: number;
  description: string;
  emoji: string;
  color: string;
  imageUrl?: string | null;
  dietaryTags?: string[];
  allergens?: string[];
  capacity?: number | null;
  displayOrder?: number;
}

function item({
  id,
  name,
  section,
  priceCents,
  description,
  emoji,
  color,
  imageUrl = null,
  dietaryTags = [],
  allergens = [],
  capacity = null,
  displayOrder = 0
}: DemoItemInput): CatalogItem {
  return {
    id,
    itemId: id,
    name,
    description,
    section,
    categoryId: `demo-${section}`,
    priceCents,
    capacity,
    soldOut: false,
    dietaryTags,
    allergens,
    displayOrder,
    imageUrl,
    emoji,
    color
  };
}

export const DEMO_CATALOG: CatalogItem[] = [
  item({
    id: "demo-box-regular",
    name: "Regular Bento",
    section: "box",
    priceCents: 0,
    description: "A six-slot box for a focused lunch.",
    emoji: "🍱",
    color: "#f4c95d",
    capacity: 6,
    displayOrder: 0
  }),
  item({
    id: "demo-box-large",
    name: "Large Bento",
    section: "box",
    priceCents: 0,
    description: "Nine slots for a proper feast.",
    emoji: "🧺",
    color: "#f28b72",
    capacity: 9,
    displayOrder: 1
  }),

  item({
    id: "protein-porterhouse",
    name: "Grilled Porterhouse",
    section: "protein",
    priceCents: 1000,
    description: "Porterhouse steak cubes, grilled to order (150g).",
    emoji: "🥩",
    color: "#c9553d",
    imageUrl: photo("0012010_home-made-beef-patty.png"),
    dietaryTags: ["high-protein"],
    displayOrder: 0
  }),
  item({
    id: "protein-calamari",
    name: "Fried Calamari",
    section: "protein",
    priceCents: 600,
    description: "Golden fried calamari rings, three pieces.",
    emoji: "🦑",
    color: "#e9a17b",
    imageUrl: photo("0012014_calamari.png"),
    allergens: ["shellfish", "gluten"],
    displayOrder: 1
  }),
  item({
    id: "protein-karaage",
    name: "Chicken Karaage",
    section: "protein",
    priceCents: 600,
    description: "House-made Japanese fried chicken (100g).",
    emoji: "🍗",
    color: "#e8a44e",
    imageUrl: photo("0012666_chicken-karaage100g.png"),
    dietaryTags: ["high-protein"],
    allergens: ["gluten", "soy"],
    displayOrder: 2
  }),
  item({
    id: "protein-scallops",
    name: "Fried Scallops",
    section: "protein",
    priceCents: 700,
    description: "Three golden fried scallops.",
    emoji: "🍤",
    color: "#efb07a",
    imageUrl: photo("0012939_fried-scallops3pcs.png"),
    allergens: ["shellfish", "gluten"],
    displayOrder: 3
  }),
  item({
    id: "protein-chicken-katsu",
    name: "Chicken Katsu",
    section: "protein",
    priceCents: 600,
    description: "House-made chicken katsu (100g).",
    emoji: "🍗",
    color: "#dfa45c",
    imageUrl: photo("0012430_chicken-katsu200g.png"),
    dietaryTags: ["high-protein"],
    allergens: ["gluten", "egg"],
    displayOrder: 4
  }),
  item({
    id: "protein-pork-katsu",
    name: "Pork Katsu",
    section: "protein",
    priceCents: 700,
    description: "House-made pork katsu (150g).",
    emoji: "🥩",
    color: "#c97a5a",
    imageUrl: photo("0012668_pork-katsu150g.png"),
    dietaryTags: ["high-protein"],
    allergens: ["gluten", "egg"],
    displayOrder: 5
  }),
  item({
    id: "protein-sausages",
    name: "Sausages",
    section: "protein",
    priceCents: 600,
    description: "Two savoury sausages, grilled and ready.",
    emoji: "🌭",
    color: "#cf7a5c",
    imageUrl: photo("0012007_sausage.png"),
    dietaryTags: ["high-protein"],
    allergens: ["gluten", "soy"],
    displayOrder: 6
  }),
  item({
    id: "protein-hamburger-steak",
    name: "Japanese Hamburger Steak",
    section: "protein",
    priceCents: 800,
    description: "Handmade beef patty, crafted in-house.",
    emoji: "🍔",
    color: "#b96a4c",
    imageUrl: photo("0012433_mixed-burgerpc.png"),
    dietaryTags: ["high-protein"],
    allergens: ["gluten", "egg", "soy", "milk"],
    displayOrder: 7
  }),
  item({
    id: "protein-beef-slice",
    name: "Beef Slice",
    section: "protein",
    priceCents: 650,
    description: "Tender sliced beef (150g).",
    emoji: "🥩",
    color: "#c9553d",
    imageUrl: photo("0019417_beef-slice150g-.png"),
    dietaryTags: ["high-protein"],
    allergens: ["soy"],
    displayOrder: 8
  }),
  item({
    id: "protein-onsen-egg",
    name: "Onsen Egg",
    section: "protein",
    priceCents: 350,
    description: "Soft-boiled onsen egg with a silky yolk.",
    emoji: "🥚",
    color: "#f4c95d",
    imageUrl: photo("0011996_onsen-egg.png"),
    dietaryTags: ["vegetarian", "gluten-free", "high-protein"],
    allergens: ["egg"],
    displayOrder: 9
  }),
  item({
    id: "protein-mozzarella",
    name: "Mozzarella Cheese",
    section: "protein",
    priceCents: 300,
    description: "Stretchy, creamy mozzarella (50g).",
    emoji: "🧀",
    color: "#f3d98b",
    imageUrl: photo("0012004_cheese-mozzarella.png"),
    dietaryTags: ["vegetarian", "high-protein"],
    allergens: ["milk"],
    displayOrder: 10
  }),

  item({
    id: "veg-mixed-vegetables",
    name: "Mixed Vegetables",
    section: "vegetable",
    priceCents: 500,
    description: "A colourful mix of seasonal vegetables.",
    emoji: "🥦",
    color: "#6fa463",
    imageUrl: photo("0012006_mixed-vegetables.png"),
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 0
  }),
  item({
    id: "veg-mixed-salad",
    name: "Mixed Salad",
    section: "vegetable",
    priceCents: 600,
    description: "Fresh mixed salad with our signature house dressing.",
    emoji: "🥗",
    color: "#7aaa61",
    imageUrl: photo("0012003_mixed-salad.png"),
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 1
  }),
  item({
    id: "veg-corn-croquette",
    name: "Corn Croquette",
    section: "vegetable",
    priceCents: 500,
    description: "Corn korokke, one piece.",
    emoji: "🌽",
    color: "#f0c54e",
    imageUrl: photo("0012432_corn-karaage.png"),
    dietaryTags: ["vegetarian"],
    allergens: ["gluten", "egg", "milk"],
    displayOrder: 2
  }),

  item({
    id: "starch-rice",
    name: "Steamed Rice",
    section: "starch",
    priceCents: 300,
    description: "Perfectly cooked Japanese rice (150g).",
    emoji: "🍚",
    color: "#f1ead9",
    imageUrl: photo("0012503_rice150g.png"),
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 0
  }),
  item({
    id: "starch-udon",
    name: "Udon Noodles",
    section: "starch",
    priceCents: 350,
    description: "Springy udon noodles (125g).",
    emoji: "🍜",
    color: "#d5c09a",
    imageUrl: photo("0019859_beef-slice150g-.png"),
    dietaryTags: ["vegetarian", "vegan"],
    allergens: ["gluten"],
    displayOrder: 1
  }),
  item({
    id: "starch-bread",
    name: "Home-made Bread",
    section: "starch",
    priceCents: 400,
    description: "Freshly baked in-house bread, three pieces.",
    emoji: "🍞",
    color: "#d9a86c",
    imageUrl: photo("0012437_home-made-bread.png"),
    dietaryTags: ["vegetarian"],
    allergens: ["gluten", "milk"],
    displayOrder: 2
  }),
  item({
    id: "starch-black-curry",
    name: "Black Curry",
    section: "sauce",
    priceCents: 300,
    description: "Kanazawa-style black curry — thick, dark and full of flavour (100g).",
    emoji: "🍛",
    color: "#5b4636",
    imageUrl: photo("0012890_black-curry100g.jpeg"),
    allergens: ["gluten", "milk", "soy"],
    displayOrder: 0
  }),
  item({
    id: "starch-yellow-curry",
    name: "Yellow Curry",
    section: "sauce",
    priceCents: 300,
    description: "Creamy coconut curry with spices, vegan and gently spicy (100g).",
    emoji: "🍛",
    color: "#e9b949",
    imageUrl: photo("0012888_green-curry100g.jpeg"),
    dietaryTags: ["vegetarian", "vegan"],
    displayOrder: 1
  }),
  item({
    id: "starch-green-curry",
    name: "Green Curry",
    section: "sauce",
    priceCents: 300,
    description: "Thai-style green curry with coconut milk and a gentle kick (100g).",
    emoji: "🍛",
    color: "#6f9c57",
    imageUrl: photo("0012889_yellow-curry100g.jpeg"),
    displayOrder: 2
  }),

  item({
    id: "protein-salmon",
    name: "Miso Salmon",
    section: "protein",
    priceCents: 750,
    description: "Caramelised miso glaze, flaked and ready.",
    emoji: "🐟",
    color: "#f28b72",
    dietaryTags: ["high-protein", "gluten-free"],
    allergens: ["fish", "soy"],
    displayOrder: 11
  }),
  item({
    id: "protein-beef",
    name: "Soy Beef",
    section: "protein",
    priceCents: 700,
    description: "Tender sliced beef with a savoury soy glaze.",
    emoji: "🥩",
    color: "#c9553d",
    dietaryTags: ["high-protein"],
    allergens: ["soy", "sesame"],
    displayOrder: 12
  }),
  item({
    id: "protein-chicken",
    name: "Teriyaki Chicken",
    section: "protein",
    priceCents: 600,
    description: "Charred chicken thigh, teriyaki glaze.",
    emoji: "🍗",
    color: "#e8a44e",
    dietaryTags: ["high-protein"],
    allergens: ["soy", "sesame"],
    displayOrder: 13
  }),
  item({
    id: "protein-tofu",
    name: "Crispy Tofu",
    section: "protein",
    priceCents: 550,
    description: "Golden tofu with sesame and spring onion.",
    emoji: "🧈",
    color: "#ead8b5",
    dietaryTags: ["vegetarian", "vegan", "high-protein"],
    allergens: ["soy", "sesame"],
    displayOrder: 14
  }),
  item({
    id: "protein-egg",
    name: "Tamagoyaki",
    section: "protein",
    priceCents: 350,
    description: "Soft rolled egg with a touch of mirin.",
    emoji: "🥚",
    color: "#f4c95d",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["egg"],
    displayOrder: 15
  }),
  item({
    id: "protein-prawn",
    name: "Garlic Prawns",
    section: "protein",
    priceCents: 800,
    description: "Prawns tossed in garlic butter and yuzu.",
    emoji: "🍤",
    color: "#ef8f73",
    dietaryTags: ["high-protein", "gluten-free"],
    allergens: ["shellfish", "milk"],
    displayOrder: 16
  }),

  item({
    id: "veg-broccoli",
    name: "Charred Broccoli",
    section: "vegetable",
    priceCents: 250,
    description: "Blistered broccoli with sesame salt.",
    emoji: "🥦",
    color: "#4f8a5b",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    allergens: ["sesame"],
    displayOrder: 3
  }),
  item({
    id: "veg-avocado",
    name: "Avocado",
    section: "vegetable",
    priceCents: 300,
    description: "Creamy avocado with lime and shiso.",
    emoji: "🥑",
    color: "#7aaa61",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 4
  }),
  item({
    id: "veg-edamame",
    name: "Edamame",
    section: "vegetable",
    priceCents: 250,
    description: "Steamed edamame with sea salt.",
    emoji: "🫛",
    color: "#76a95f",
    dietaryTags: ["vegetarian", "vegan", "high-protein"],
    allergens: ["soy"],
    displayOrder: 5
  }),
  item({
    id: "veg-cucumber",
    name: "Pickled Cucumber",
    section: "vegetable",
    priceCents: 200,
    description: "Crunchy cucumber, rice vinegar, chilli.",
    emoji: "🥒",
    color: "#9cc47b",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 6
  }),
  item({
    id: "veg-carrot",
    name: "Kinpira Carrot",
    section: "vegetable",
    priceCents: 200,
    description: "Carrot ribbons with sesame and ginger.",
    emoji: "🥕",
    color: "#ef9b45",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    allergens: ["sesame"],
    displayOrder: 7
  }),
  item({
    id: "veg-mushroom",
    name: "Shiitake",
    section: "vegetable",
    priceCents: 250,
    description: "Butter-soy shiitake mushrooms.",
    emoji: "🍄",
    color: "#9d7658",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["soy", "milk"],
    displayOrder: 8
  }),
  item({
    id: "veg-corn",
    name: "Sweetcorn",
    section: "vegetable",
    priceCents: 200,
    description: "Charred corn with chilli lime butter.",
    emoji: "🌽",
    color: "#f0c54e",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["milk"],
    displayOrder: 9
  }),

  item({
    id: "starch-brown-rice",
    name: "Brown Rice",
    section: "starch",
    priceCents: 280,
    description: "Nutty brown rice with furikake.",
    emoji: "🌾",
    color: "#d7bf8f",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    allergens: ["sesame"],
    displayOrder: 6
  }),
  item({
    id: "starch-soba",
    name: "Soba Noodles",
    section: "starch",
    priceCents: 300,
    description: "Chilled soba with a light soy dressing.",
    emoji: "🍜",
    color: "#b59b6b",
    dietaryTags: ["vegetarian", "vegan"],
    allergens: ["gluten", "soy"],
    displayOrder: 7
  }),
  item({
    id: "starch-sweet-potato",
    name: "Roast Sweet Potato",
    section: "starch",
    priceCents: 300,
    description: "Caramelised sweet potato wedges.",
    emoji: "🍠",
    color: "#dd8b5b",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 8
  }),
  item({
    id: "starch-sushi-rice",
    name: "Sushi Rice",
    section: "starch",
    priceCents: 250,
    description: "Seasoned Japanese rice.",
    emoji: "🍚",
    color: "#f1ead9",
    dietaryTags: ["vegetarian", "vegan", "gluten-free"],
    displayOrder: 9
  })
];
