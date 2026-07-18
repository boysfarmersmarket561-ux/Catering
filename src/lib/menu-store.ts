import { useEffect, useState, useCallback } from "react";

/* -------- Cart -------- */

const CART_KEY = "boys-quote-cart-v2";

export interface CartLine {
  itemId: string;
  tierId: string | null; // null = price-on-request item with no tiers
  name: string;
  category: string;
  section: string;
  tierLabel: string; // display string, e.g. "Small — $59.99" or "Price on request"
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
    const idx = cur.findIndex((l) => l.itemId === line.itemId && l.tierId === line.tierId);
    if (idx >= 0) {
      cur[idx].quantity += line.quantity ?? 1;
    } else {
      cur.push({ ...line, quantity: line.quantity ?? 1 });
    }
    writeCart(cur);
  }, []);

  const setQty = useCallback((itemId: string, tierId: string | null, qty: number) => {
    const cur = readCart()
      .map((l) => (l.itemId === itemId && l.tierId === tierId ? { ...l, quantity: qty } : l))
      .filter((l) => l.quantity > 0);
    writeCart(cur);
  }, []);

  const remove = useCallback((itemId: string, tierId: string | null) => {
    writeCart(readCart().filter((l) => !(l.itemId === itemId && l.tierId === tierId)));
  }, []);

  const clear = useCallback(() => writeCart([]), []);

  const subtotal = cart.reduce((sum, l) => sum + (l.unitAmount ?? 0) * l.quantity, 0);
  const hasUnpriced = cart.some((l) => l.unitAmount == null);

  return { cart, addLine, setQty, remove, clear, subtotal, hasUnpriced };
}
