import { describe, expect, it } from "vitest";
import { buildQuote } from "@/lib/domain/quote";
import { DEMO_CATALOG } from "@/lib/demo-catalog";
import { AppError } from "@/lib/types";

const regularBox = DEMO_CATALOG.find((item) => item.id === "demo-box-regular")!;
const chicken = DEMO_CATALOG.find((item) => item.id === "protein-chicken")!;
const salmon = DEMO_CATALOG.find((item) => item.id === "protein-salmon")!;
const broccoli = DEMO_CATALOG.find((item) => item.id === "veg-broccoli")!;
const rice = DEMO_CATALOG.find((item) => item.id === "starch-rice")!;

function quote(selections: Array<{ itemId: string; quantity: number }>) {
  return buildQuote({
    boxItemId: regularBox.id,
    selections,
    catalog: DEMO_CATALOG,
    currency: "AUD"
  });
}

describe("buildQuote", () => {
  it("requires at least one protein and one vegetable", () => {
    expect(() => quote([{ itemId: chicken.id, quantity: 1 }])).toThrowError(AppError);
    try {
      quote([{ itemId: chicken.id, quantity: 1 }]);
    } catch (error) {
      expect(error).toMatchObject({ code: "MINIMUM_NOT_MET" });
    }
  });

  it("enforces the selected box capacity", () => {
    expect(() =>
      quote([
        { itemId: chicken.id, quantity: 4 },
        { itemId: broccoli.id, quantity: 3 }
      ])
    ).toThrowError(/fits 6 portions/);
  });

  it("merges duplicate selections and calculates the total", () => {
    const result = quote([
      { itemId: chicken.id, quantity: 1 },
      { itemId: salmon.id, quantity: 1 },
      { itemId: chicken.id, quantity: 1 },
      { itemId: broccoli.id, quantity: 2 },
      { itemId: rice.id, quantity: 1 }
    ]);

    expect(result.totalPortions).toBe(6);
    expect(result.lines.find((line) => line.itemId === chicken.id)?.quantity).toBe(2);
    expect(result.totalCents).toBe(600 * 2 + 750 + 250 * 2 + 250);
  });

  it("rejects sold-out ingredients with the live catalog price", () => {
    const soldOut = DEMO_CATALOG.map((item) =>
      item.id === chicken.id ? { ...item, soldOut: true } : item
    );
    expect(() =>
      buildQuote({
        boxItemId: regularBox.id,
        selections: [
          { itemId: chicken.id, quantity: 1 },
          { itemId: broccoli.id, quantity: 1 }
        ],
        catalog: soldOut,
        currency: "AUD"
      })
    ).toThrowError(/sold out/);
  });

  it("allows a box with no starch", () => {
    const result = quote([
      { itemId: chicken.id, quantity: 2 },
      { itemId: broccoli.id, quantity: 2 }
    ]);
    expect(result.lines.some((line) => line.section === "starch")).toBe(false);
    expect(result.totalPortions).toBe(4);
  });
});
