import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/lib/demo-catalog";

const dishes = DEMO_CATALOG.filter((item) => item.section !== "box");
const sourcedDishes = dishes.filter((item) => item.imageUrl);
const legacyIds = [
  "protein-salmon",
  "protein-beef",
  "protein-chicken",
  "protein-tofu",
  "protein-egg",
  "protein-prawn",
  "veg-broccoli",
  "veg-avocado",
  "veg-edamame",
  "veg-cucumber",
  "veg-carrot",
  "veg-mushroom",
  "veg-corn",
  "starch-brown-rice",
  "starch-soba",
  "starch-sweet-potato",
  "starch-sushi-rice"
];

describe("demo catalog", () => {
  it("contains the dishes supplied in demo-data", () => {
    expect(sourcedDishes).toHaveLength(20);
    expect(sourcedDishes.filter((item) => item.section === "protein")).toHaveLength(11);
    expect(sourcedDishes.filter((item) => item.section === "vegetable")).toHaveLength(3);
    expect(sourcedDishes.filter((item) => item.section === "starch")).toHaveLength(3);
    expect(sourcedDishes.filter((item) => item.section === "sauce")).toHaveLength(3);
    expect(
      sourcedDishes.filter((item) => item.section === "sauce").map((item) => item.id)
    ).toEqual(["starch-black-curry", "starch-yellow-curry", "starch-green-curry"]);
  });

  it("keeps the original demo dishes alongside the sourced dishes", () => {
    for (const id of legacyIds) {
      expect(dishes.some((item) => item.id === id), id).toBe(true);
    }
    expect(dishes).toHaveLength(sourcedDishes.length + legacyIds.length);
  });

  it("gives every sourced dish a remote photo", () => {
    for (const dish of sourcedDishes) {
      expect(dish.imageUrl, dish.name).toMatch(
        /^https:\/\/www\.ja2square\.com\.au\/images\/thumbs\//
      );
    }
  });

  it("keeps emoji fallbacks for the original dishes", () => {
    for (const id of legacyIds) {
      const dish = dishes.find((item) => item.id === id);
      expect(dish?.imageUrl, id).toBeNull();
      expect(dish?.emoji, id).toBeTruthy();
    }
  });

  it("keeps enough choices for Pick For Me", () => {
    expect(dishes.filter((item) => item.section === "protein").length).toBeGreaterThanOrEqual(2);
    expect(dishes.filter((item) => item.section === "vegetable").length).toBeGreaterThanOrEqual(3);
    expect(dishes.filter((item) => item.section === "starch").length).toBeGreaterThanOrEqual(1);
    expect(dishes.filter((item) => item.section === "sauce").length).toBeGreaterThanOrEqual(2);
  });
});
