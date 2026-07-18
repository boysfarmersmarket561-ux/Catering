import { describe, expect, it } from "vitest";
import { resolveQuoteLines, type QuoteItemRow } from "@/lib/quote-lines";

const items: QuoteItemRow[] = [
  {
    id: "i1",
    name: "Fruit Platter",
    active: true,
    section: { name: "Platters", active: true, category: { name: "Fresh Fruit", active: true } },
    price_tiers: [{ id: "t1", label: "Large", amount: "89.99", unit: "platter" }],
  },
  {
    id: "i2",
    name: "Carving Station",
    active: true,
    section: { name: "Stations", active: true, category: { name: "Mains", active: true } },
    price_tiers: [],
  },
  {
    id: "i3",
    name: "Hidden",
    active: false,
    section: { name: "Platters", active: true, category: { name: "Fresh Fruit", active: true } },
    price_tiers: [{ id: "t3", label: null, amount: "5", unit: "each" }],
  },
];

describe("resolveQuoteLines", () => {
  it("snapshots names and prices from the DB, not the client", () => {
    const { lines, subtotal, hasUnpriced } = resolveQuoteLines(items, [
      { itemId: "i1", tierId: "t1", quantity: 2 },
      { itemId: "i2", tierId: null, quantity: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      itemName: "Fruit Platter",
      categoryName: "Fresh Fruit",
      sectionName: "Platters",
      tierLabel: "Large",
      unit: "platter",
      unitAmount: 89.99,
      quantity: 2,
    });
    expect(lines[1].unitAmount).toBeNull();
    expect(subtotal).toBeCloseTo(179.98);
    expect(hasUnpriced).toBe(true);
  });
  it("drops unknown items, inactive items, and unknown tiers", () => {
    const { lines } = resolveQuoteLines(items, [
      { itemId: "nope", tierId: null, quantity: 1 },
      { itemId: "i3", tierId: "t3", quantity: 1 },
      { itemId: "i1", tierId: "wrong-tier", quantity: 1 },
    ]);
    expect(lines).toHaveLength(0);
  });
});
