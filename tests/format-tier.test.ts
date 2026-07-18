import { describe, expect, it } from "vitest";
import { formatTier, isPricedItem, type CatalogItem } from "@/lib/catalog-types";

describe("formatTier", () => {
  it("formats amount with unit suffix", () => {
    expect(formatTier({ amount: 34.99, unit: "per_person" })).toBe("$34.99 /person");
    expect(formatTier({ amount: 12.5, unit: "per_lb" })).toBe("$12.50 /lb");
    expect(formatTier({ amount: 9, unit: "each" })).toBe("$9.00 each");
  });
  it("omits suffix for platter/per_pieces", () => {
    expect(formatTier({ amount: 60, unit: "platter" })).toBe("$60.00");
    expect(formatTier({ amount: 15, unit: "per_pieces" })).toBe("$15.00");
  });
  it("renders null amount as price on request", () => {
    expect(formatTier({ amount: null, unit: "each" })).toBe("Price on request");
  });
});

describe("isPricedItem", () => {
  const base: Omit<CatalogItem, "tiers"> = {
    id: "i1",
    name: "X",
    description: null,
    size: null,
    serves: null,
    imageUrl: null,
    active: true,
  };
  it("false with no tiers or only null amounts", () => {
    expect(isPricedItem({ ...base, tiers: [] })).toBe(false);
    expect(
      isPricedItem({ ...base, tiers: [{ id: "t", label: null, amount: null, unit: "each" }] }),
    ).toBe(false);
  });
  it("true when any tier has an amount", () => {
    expect(
      isPricedItem({ ...base, tiers: [{ id: "t", label: "Sm", amount: 5, unit: "each" }] }),
    ).toBe(true);
  });
});
