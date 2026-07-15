import { Link } from "@tanstack/react-router";
import { ShoppingBasket } from "lucide-react";
import { useCart } from "@/lib/menu-store";

export function CartIndicator() {
  const { cart } = useCart();
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  return (
    <Link
      to="/quote"
      aria-label="View quote cart"
      className="relative grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-accent hover:text-accent-foreground"
    >
      <ShoppingBasket className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}