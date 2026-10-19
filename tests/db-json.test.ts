import { describe, expect, it } from "vitest";
import { parseJsonColumn } from "@/lib/db/json";

describe("parseJsonColumn", () => {
  it("returns object payloads unchanged", () => {
    const value = { orderId: "abc" };
    expect(parseJsonColumn(value, {})).toEqual(value);
  });

  it("parses payloads returned as JSON strings", () => {
    expect(parseJsonColumn('{"orderId":"abc"}', {})).toEqual({ orderId: "abc" });
  });

  it("falls back when a string is not valid JSON", () => {
    expect(parseJsonColumn("not-json", {})).toEqual({});
  });

  it("falls back for null values", () => {
    expect(parseJsonColumn(null, { orderId: "fallback" })).toEqual({
      orderId: "fallback"
    });
  });
});
