import { describe, expect, it } from "vitest";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";

const rows: DbCategoryRow[] = [
  {
    id: "c2",
    name: "Desserts",
    description: null,
    image_path: null,
    sort_order: 1,
    active: true,
    sections: [],
  },
  {
    id: "c1",
    name: "Fruit",
    description: "Fresh",
    image_path: "categories/c1.jpg",
    sort_order: 0,
    active: true,
    sections: [
      {
        id: "s1",
        name: "Platters",
        note: null,
        sort_order: 0,
        active: true,
        items: [
          {
            id: "i2",
            name: "Hidden",
            description: null,
            size: null,
            serves: null,
            image_path: null,
            sort_order: 0,
            active: false,
            price_tiers: [],
          },
          {
            id: "i1",
            name: "Fruit Platter",
            description: null,
            size: "16 in",
            serves: "25",
            image_path: "items/i1.jpg",
            sort_order: 1,
            active: true,
            price_tiers: [
              { id: "t2", label: "Large", amount: "89.99", unit: "platter", sort_order: 1 },
              { id: "t1", label: "Small", amount: "59.99", unit: "platter", sort_order: 0 },
            ],
          },
        ],
      },
      { id: "s2", name: "Off", note: null, sort_order: 1, active: false, items: [] },
    ],
  },
];

const IMG = "https://x.supabase.co/storage/v1/object/public/menu-images";

describe("mapCatalogRows", () => {
  it("sorts by sort_order at every level and coerces numeric strings", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out.map((c) => c.name)).toEqual(["Fruit", "Desserts"]);
    const tiers = out[0].sections[0].items[0].tiers;
    expect(tiers.map((t) => t.label)).toEqual(["Small", "Large"]);
    expect(tiers[0].amount).toBe(59.99);
  });
  it("filters inactive items and sections when includeInactive is false", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out[0].sections).toHaveLength(1);
    expect(out[0].sections[0].items.map((i) => i.name)).toEqual(["Fruit Platter"]);
  });
  it("keeps inactive rows when includeInactive is true", () => {
    const out = mapCatalogRows(rows, { includeInactive: true, imageBase: IMG });
    expect(out[0].sections).toHaveLength(2);
    expect(out[0].sections[0].items).toHaveLength(2);
  });
  it("builds public image urls, null when no path", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out[0].imageUrl).toBe(`${IMG}/categories/c1.jpg`);
    expect(out[1].imageUrl).toBeNull();
  });
});
