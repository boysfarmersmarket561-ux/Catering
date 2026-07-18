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
