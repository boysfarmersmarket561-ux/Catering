import { useEffect, useState, useCallback } from "react";
import { baseMenu, itemId, type MenuData, type MenuItem, type Price } from "@/data/menu";

const OVERLAY_KEY = "boys-menu-overlay-v1";

type ItemOverride = Partial<Pick<MenuItem, "name" | "description" | "size" | "serves">> & {
  prices?: Price[];
};
type Overlay = Record<string, ItemOverride>;

function readOverlay(): Overlay {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OVERLAY_KEY) || "{}") as Overlay;
  } catch {
    return {};
  }
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  window.dispatchEvent(new Event("boys-menu-updated"));
}

export function applyOverlay(data: MenuData, overlay: Overlay): MenuData {
  return {
    ...data,
    categories: data.categories.map((c) => ({
      ...c,
      sections: c.sections.map((s) => ({
        ...s,
        items: s.items.map((it) => {
          const id = itemId(c.name, s.name, it.name);
          const ov = overlay[id];
          return ov ? { ...it, ...ov } : it;
        }),
      })),
    })),
  };
}

export function useMenu(): MenuData {
  const [overlay, setOverlay] = useState<Overlay>({});
  useEffect(() => {
    setOverlay(readOverlay());
    const handler = () => setOverlay(readOverlay());
    window.addEventListener("boys-menu-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("boys-menu-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return applyOverlay(baseMenu, overlay);
}

export function updateItem(id: string, patch: ItemOverride) {
  const overlay = readOverlay();
  overlay[id] = { ...overlay[id], ...patch };
  writeOverlay(overlay);
}

export function resetMenu() {
  localStorage.removeItem(OVERLAY_KEY);
  window.dispatchEvent(new Event("boys-menu-updated"));
}

export function getOverlay(): Overlay {
  return readOverlay();
}

/** Flatten all items for tables/search. */
export interface FlatItem {
  id: string;
  category: string;
  section: string;
  item: MenuItem;
}

export function flattenMenu(data: MenuData): FlatItem[] {
  const out: FlatItem[] = [];
  for (const c of data.categories) {
    for (const s of c.sections) {
      for (const it of s.items) {
        out.push({ id: itemId(c.name, s.name, it.name), category: c.name, section: s.name, item: it });
      }
    }
  }
  return out;
}

/* -------- Cart -------- */

const CART_KEY = "boys-quote-cart-v1";

export interface CartLine {
  id: string;
  category: string;
  section: string;
  name: string;
  priceLabel: string; // formatted price string chosen tier
  priceIndex: number; // which price tier
  unitAmount: number | null; // for subtotal (null = unpriced)
  quantity: number;
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartLine[];
  } catch {
    return [];
  }
}

function writeCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("boys-cart-updated"));
}

export function useCart() {
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    setCart(readCart());
    const h = () => setCart(readCart());
    window.addEventListener("boys-cart-updated", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("boys-cart-updated", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const addLine = useCallback((line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
    const cur = readCart();
    const idx = cur.findIndex((l) => l.id === line.id && l.priceIndex === line.priceIndex);
    if (idx >= 0) {
      cur[idx].quantity += line.quantity ?? 1;
    } else {
      cur.push({ ...line, quantity: line.quantity ?? 1 });
    }
    writeCart(cur);
  }, []);

  const setQty = useCallback((id: string, priceIndex: number, qty: number) => {
    const cur = readCart()
      .map((l) => (l.id === id && l.priceIndex === priceIndex ? { ...l, quantity: qty } : l))
      .filter((l) => l.quantity > 0);
    writeCart(cur);
  }, []);

  const remove = useCallback((id: string, priceIndex: number) => {
    writeCart(readCart().filter((l) => !(l.id === id && l.priceIndex === priceIndex)));
  }, []);

  const clear = useCallback(() => writeCart([]), []);

  const subtotal = cart.reduce((sum, l) => sum + (l.unitAmount ?? 0) * l.quantity, 0);
  const hasUnpriced = cart.some((l) => l.unitAmount == null);

  return { cart, addLine, setQty, remove, clear, subtotal, hasUnpriced };
}

/* -------- Quote requests -------- */

const QUOTES_KEY = "boys-quote-requests-v1";

export interface QuoteRequest {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  guestCount: string;
  notes: string;
  lines: CartLine[];
  subtotal: number;
}

export function readQuotes(): QuoteRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUOTES_KEY) || "[]") as QuoteRequest[];
  } catch {
    return [];
  }
}

export function saveQuote(q: Omit<QuoteRequest, "id" | "createdAt">): QuoteRequest {
  const full: QuoteRequest = {
    ...q,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = [full, ...readQuotes()];
  localStorage.setItem(QUOTES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("boys-quotes-updated"));
  return full;
}

export function deleteQuote(id: string) {
  const all = readQuotes().filter((q) => q.id !== id);
  localStorage.setItem(QUOTES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("boys-quotes-updated"));
}

export function useQuotes() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  useEffect(() => {
    setQuotes(readQuotes());
    const h = () => setQuotes(readQuotes());
    window.addEventListener("boys-quotes-updated", h);
    return () => window.removeEventListener("boys-quotes-updated", h);
  }, []);
  return quotes;
}
