import { Link, useRouterState } from "@tanstack/react-router";
import { baseMenu } from "@/data/menu";
import { Leaf, Phone, Mail, MapPin } from "lucide-react";
import { CartIndicator } from "./cart-indicator";

const nav = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/quote", label: "Build a Quote" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const b = baseMenu.business;
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold text-primary">{b.name}</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {b.menu_title}
            </span>
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {nav.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-secondary hover:text-secondary-foreground")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <CartIndicator />
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="whitespace-nowrap rounded-full px-3 py-1 text-sm text-foreground/80 hover:bg-secondary"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const b = baseMenu.business;
  return (
    <footer className="mt-16 border-t border-border/70 bg-primary/5">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="font-display text-xl text-primary">{b.name}</h3>
          <p className="mt-2 text-sm italic text-muted-foreground">{b.tagline}</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 text-primary" />
            <span>
              {b.address.street}
              <br />
              {b.address.city}, {b.address.state} {b.address.zip}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> {b.phone}
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <a className="hover:underline" href={`mailto:${b.bakery_email}`}>
              {b.bakery_email}
            </a>
          </div>
        </div>
        <div className="text-sm">
          <h4 className="mb-2 font-semibold">Hours</h4>
          <p className="text-muted-foreground">Monday – Sunday</p>
          <p>8:30 AM – 6:00 PM</p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {b.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}