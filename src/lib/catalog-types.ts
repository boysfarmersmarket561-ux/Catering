export type PriceUnit =
  | "platter"
  | "per_person"
  | "per_lb"
  | "per_foot"
  | "each"
  | "per_kabob"
  | "per_pastry"
  | "per_pieces";

export const PRICE_UNITS: PriceUnit[] = [
  "platter",
  "per_person",
  "per_lb",
  "per_foot",
  "each",
  "per_kabob",
  "per_pastry",
  "per_pieces",
];

export interface CatalogTier {
  id: string;
  label: string | null;
  amount: number | null; // null = price on request
  unit: PriceUnit;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  size: string | null;
  serves: string | null;
  imageUrl: string | null;
  active: boolean;
  tiers: CatalogTier[];
}

export interface CatalogSection {
  id: string;
  name: string;
  note: string | null;
  active: boolean;
  items: CatalogItem[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sections: CatalogSection[];
}

export function formatUnit(unit: PriceUnit): string {
  switch (unit) {
    case "per_person":
      return "/person";
    case "per_lb":
      return "/lb";
    case "per_foot":
      return "/ft";
    case "each":
      return "each";
    case "per_kabob":
      return "/kabob";
    case "per_pastry":
      return "/pastry";
    case "per_pieces":
      return "";
    case "platter":
      return "";
  }
}

export function formatTier(t: { amount: number | null; unit: PriceUnit }): string {
  if (t.amount == null) return "Price on request";
  const amt = `$${t.amount.toFixed(2)}`;
  const unit = formatUnit(t.unit);
  return unit ? `${amt} ${unit}` : amt;
}

export function isPricedItem(item: CatalogItem): boolean {
  return item.tiers.some((t) => t.amount != null);
}
