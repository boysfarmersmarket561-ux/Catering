import { Link, useRouterState } from "@tanstack/react-router";
import { baseMenu } from "@/data/menu";
import { Phone, Mail, MapPin, Facebook, Instagram, Clock } from "lucide-react";
import { CartIndicator } from "./cart-indicator";
import fruitHeader from "@/assets/boys-fruit-header.png";
import boysLogo from "@/assets/boys-logo.png";

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
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      {/* Utility bar */}
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs text-primary sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Store Hours:</span> Monday – Sunday 8:30am – 6:00pm
          </span>
          <span className="flex items-center gap-4">
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-accent">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-accent">
              <Instagram className="h-4 w-4" />
            </a>
          </span>
        </div>
      </div>

      {/* Fruit-border band with centered logo */}
      <div className="relative bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-top bg-repeat-x sm:h-40 lg:h-48"
          style={{
            backgroundImage: `url(${fruitHeader})`,
            backgroundSize: "auto 100%",
          }}
        />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-28 pb-5 sm:px-6 sm:pt-36 lg:px-8 lg:pt-44">
          <Link to="/" aria-label={b.name} className="block">
            <img src={boysLogo} alt={b.name} className="h-28 w-auto sm:h-36 lg:h-44" />
          </Link>
          <span className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground sm:text-sm">
            Located in Delray Beach, FL
          </span>
        </div>
      </div>

      {/* Main nav */}
      <div className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <nav className="flex flex-1 items-center justify-center gap-2 overflow-x-auto sm:gap-5">
            {nav.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "relative whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition-colors sm:text-base " +
                    (active
                      ? "text-primary"
                      : "text-primary/80 hover:text-primary")
                  }
                >
                  {n.label}
                  <span
                    className={
                      "pointer-events-none absolute inset-x-3 -bottom-[1px] h-[3px] transition-all " +
                      (active ? "bg-accent" : "bg-transparent group-hover:bg-accent")
                    }
                  />
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0">
            <CartIndicator />
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const b = baseMenu.business;
  return (
    <footer className="mt-24 border-t-2 border-accent/60 bg-secondary">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <img src={boysLogo} alt={b.name} className="h-24 w-auto" />
          <p className="mt-4 text-base italic text-muted-foreground">{b.tagline}</p>
        </div>
        <div className="space-y-3 text-base">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <span>
              {b.address.street}
              <br />
              {b.address.city}, {b.address.state} {b.address.zip}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> {b.phone}
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <a className="hover:underline" href={`mailto:${b.bakery_email}`}>
              {b.bakery_email}
            </a>
          </div>
        </div>
        <div className="text-base">
          <h4 className="mb-3 font-display text-2xl">Hours</h4>
          <p className="text-muted-foreground">Monday – Sunday</p>
          <p>8:30 AM – 6:00 PM</p>
          <p className="mt-4 text-sm text-muted-foreground">
            © {new Date().getFullYear()} {b.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}