import { describe, expect, it } from "vitest";
import { buildQuote } from "@/lib/domain/quote";
import { DEMO_CATALOG } from "@/lib/demo-catalog";
import { AppError } from "@/lib/types";

const regularBox = DEMO_CATALOG.find((item) => item.id === "demo-box-regular")!;
const largeBox = DEMO_CATALOG.find((item) => item.id === "demo-box-large")!;
const karaage = DEMO_CATALOG.find((item) => item.id === "protein-karaage")!;
const porterhouse = DEMO_CATALOG.find((item) => item.id === "protein-porterhouse")!;
const mixedVegetables = DEMO_CATALOG.find((item) => item.id === "veg-mixed-vegetables")!;
const rice = DEMO_CATALOG.find((item) => item.id === "starch-rice")!;
const yellowCurry = DEMO_CATALOG.find((item) => item.id === "starch-yellow-curry")!;
const greenCurry = DEMO_CATALOG.find((item) => item.id === "starch-green-curry")!;

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
    expect(() => quote([{ itemId: karaage.id, quantity: 1 }])).toThrowError(AppError);
    try {
      quote([{ itemId: karaage.id, quantity: 1 }]);
    } catch (error) {
      expect(error).toMatchObject({ code: "MINIMUM_NOT_MET" });
    }
  });

  it("enforces the selected box capacity", () => {
    expect(() =>
      quote([
        { itemId: karaage.id, quantity: 4 },
        { itemId: mixedVegetables.id, quantity: 3 }
      ])
    ).toThrowError(/fits 6 portions/);
  });

  it("merges duplicate selections and calculates the total", () => {
    const result = quote([
      { itemId: karaage.id, quantity: 1 },
      { itemId: porterhouse.id, quantity: 1 },
      { itemId: karaage.id, quantity: 1 },
      { itemId: mixedVegetables.id, quantity: 2 },
      { itemId: rice.id, quantity: 1 }
    ]);

    expect(result.totalPortions).toBe(6);
    expect(result.lines.find((line) => line.itemId === karaage.id)?.quantity).toBe(2);
    expect(result.totalCents).toBe(
      karaage.priceCents * 2 + porterhouse.priceCents + mixedVegetables.priceCents * 2 + rice.priceCents
    );
  });

  it("rejects sold-out ingredients with the live catalog price", () => {
    const soldOut = DEMO_CATALOG.map((item) =>
      item.id === karaage.id ? { ...item, soldOut: true } : item
    );
    expect(() =>
      buildQuote({
        boxItemId: regularBox.id,
        selections: [
          { itemId: karaage.id, quantity: 1 },
          { itemId: mixedVegetables.id, quantity: 1 }
        ],
        catalog: soldOut,
        currency: "AUD"
      })
    ).toThrowError(/sold out/);
  });

  it("allows a box with no starch", () => {
    const result = quote([
      { itemId: karaage.id, quantity: 2 },
      { itemId: mixedVegetables.id, quantity: 2 }
    ]);
    expect(result.lines.some((line) => line.section === "starch")).toBe(false);
    expect(result.totalPortions).toBe(4);
  });

  it("prices sauces without counting them against the dish capacity", () => {
    const result = quote([
      { itemId: karaage.id, quantity: 2 },
      { itemId: mixedVegetables.id, quantity: 2 },
      { itemId: yellowCurry.id, quantity: 1 }
    ]);

    expect(result.totalPortions).toBe(4);
    expect(result.totalCents).toBe(
      karaage.priceCents * 2 + mixedVegetables.priceCents * 2 + yellowCurry.priceCents
    );
    expect(result.lines.find((line) => line.itemId === yellowCurry.id)).toMatchObject({
      section: "sauce",
      quantity: 1
    });
  });

  it("allows two portions of the same sauce", () => {
    const result = quote([
      { itemId: karaage.id, quantity: 1 },
      { itemId: mixedVegetables.id, quantity: 1 },
      { itemId: yellowCurry.id, quantity: 2 }
    ]);

    expect(result.lines.find((line) => line.itemId === yellowCurry.id)?.quantity).toBe(2);
    expect(result.totalPortions).toBe(2);
  });

  it("rejects a third sauce portion", () => {
    expect(() =>
      quote([
        { itemId: karaage.id, quantity: 1 },
        { itemId: mixedVegetables.id, quantity: 1 },
        { itemId: yellowCurry.id, quantity: 2 },
        { itemId: greenCurry.id, quantity: 1 }
      ])
    ).toThrowError(/up to 2 sauces/);

    try {
      quote([
        { itemId: karaage.id, quantity: 1 },
        { itemId: mixedVegetables.id, quantity: 1 },
        { itemId: yellowCurry.id, quantity: 2 },
        { itemId: greenCurry.id, quantity: 1 }
      ]);
    } catch (error) {
      expect(error).toMatchObject({ code: "SAUCE_LIMIT_EXCEEDED" });
    }
  });

  it("accepts nine dishes in the large box", () => {
    const result = buildQuote({
      boxItemId: largeBox.id,
      selections: [
        { itemId: karaage.id, quantity: 5 },
        { itemId: mixedVegetables.id, quantity: 4 }
      ],
      catalog: DEMO_CATALOG,
      currency: "AUD"
    });

    expect(result.totalPortions).toBe(9);
    expect(result.boxCapacity).toBe(9);
  });
});
