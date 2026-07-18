import type { CatalogCategory, PriceUnit } from "./catalog-types";

export interface DbTierRow {
  id: string;
  label: string | null;
  amount: string | number | null;
  unit: string;
  sort_order: number;
}
export interface DbItemRow {
  id: string;
  name: string;
  description: string | null;
  size: string | null;
  serves: string | null;
  image_path: string | null;
  sort_order: number;
  active: boolean;
  price_tiers: DbTierRow[];
}
export interface DbSectionRow {
  id: string;
  name: string;
  note: string | null;
  sort_order: number;
  active: boolean;
  items: DbItemRow[];
}
export interface DbCategoryRow {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  active: boolean;
  sections: DbSectionRow[];
}

interface MapOpts {
  includeInactive: boolean;
  imageBase: string;
}

const bySort = (a: { sort_order: number }, b: { sort_order: number }) =>
  a.sort_order - b.sort_order;

function img(base: string, path: string | null): string | null {
  return path ? `${base}/${path}` : null;
}

export function mapCatalogRows(rows: DbCategoryRow[], opts: MapOpts): CatalogCategory[] {
  const keep = (x: { active: boolean }) => opts.includeInactive || x.active;
  return [...rows]
    .filter(keep)
    .sort(bySort)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      imageUrl: img(opts.imageBase, c.image_path),
      active: c.active,
      sections: [...c.sections]
        .filter(keep)
        .sort(bySort)
        .map((s) => ({
          id: s.id,
          name: s.name,
          note: s.note,
          active: s.active,
          items: [...s.items]
            .filter(keep)
            .sort(bySort)
            .map((i) => ({
              id: i.id,
              name: i.name,
              description: i.description,
              size: i.size,
              serves: i.serves,
              imageUrl: img(opts.imageBase, i.image_path),
              active: i.active,
              tiers: [...i.price_tiers].sort(bySort).map((t) => ({
                id: t.id,
                label: t.label,
                amount: t.amount == null ? null : Number(t.amount),
                unit: t.unit as PriceUnit,
              })),
            })),
        })),
    }));
}
