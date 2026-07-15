import raw from "./menu.json";

export type PriceUnit =
  | "platter"
  | "per_person"
  | "per_lb"
  | "per_foot"
  | "each"
  | "per_kabob"
  | "per_pastry"
  | "per_pieces"
  | "unpriced";

export interface Price {
  label: string | null;
  amount: number | null;
  unit: PriceUnit;
}

export interface MenuItem {
  name: string;
  description?: string | null;
  size?: string | null;
  serves?: string | null;
  prices: Price[];
}

export interface MenuSection {
  name: string;
  note?: string | null;
  items: MenuItem[];
}

export interface MenuCategory {
  name: string;
  page?: number;
  sections: MenuSection[];
}

export interface Business {
  name: string;
  menu_title: string;
  tagline: string;
  address: { street: string; city: string; state: string; zip: string };
  phone: string;
  fax: string;
  website: string;
  bakery_email: string;
}

export interface MenuData {
  business: Business;
  categories: MenuCategory[];
}

export const baseMenu = raw as unknown as MenuData;

/** Stable id for an item — category > section > name (lowercased, slugged). */
export function itemId(category: string, section: string, name: string): string {
  return [category, section, name]
    .map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join("__");
}

export function formatUnit(unit: PriceUnit): string {
  switch (unit) {
    case "per_person": return "/person";
    case "per_lb": return "/lb";
    case "per_foot": return "/ft";
    case "each": return "each";
    case "per_kabob": return "/kabob";
    case "per_pastry": return "/pastry";
    case "per_pieces": return "";
    case "platter": return "";
    case "unpriced": return "";
  }
}

export function formatPrice(p: Price): string {
  if (p.amount == null || p.unit === "unpriced") return "Price on request";
  const amt = `$${p.amount.toFixed(2)}`;
  const unit = formatUnit(p.unit);
  return unit ? `${amt} ${unit}` : amt;
}

export function isPriced(item: MenuItem): boolean {
  return item.prices.some((p) => p.amount != null && p.unit !== "unpriced");
}

export function minPrice(item: MenuItem): number | null {
  const priced = item.prices.filter((p) => p.amount != null).map((p) => p.amount as number);
  return priced.length ? Math.min(...priced) : null;
}
