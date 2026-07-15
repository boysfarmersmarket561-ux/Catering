import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { baseMenu } from "@/data/menu";
import { ArrowRight, MapPin, Sparkles, Utensils } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Index() {
  const b = baseMenu.business;
  const categories = baseMenu.categories;
  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border bg-background">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-24 lg:px-8">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            <MapPin className="h-3 w-3" /> Delray Beach, FL
          </span>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] text-primary md:text-6xl lg:text-7xl">
            Catering
          </h1>
          <div className="mx-auto mt-4 h-[2px] w-24 bg-accent" />
          <p className="mx-auto mt-6 max-w-2xl text-lg italic text-muted-foreground">
            {b.tagline}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/menu">
                Browse the Menu <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/quote">Request a Quote</Link>
            </Button>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-10 text-sm">
            <Stat n="230+" label="Handcrafted items" />
            <Stat n="8" label="Menu categories" />
            <Stat n="7" label="Days a week" />
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Explore
            </span>
            <h2 className="mt-2 font-display text-4xl">Every occasion, catered.</h2>
          </div>
          <Link to="/menu" className="hidden text-sm font-semibold text-primary hover:underline sm:inline">
            View full menu →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => {
            const count = c.sections.reduce((n, s) => n + s.items.length, 0);
            return (
              <Link
                key={c.name}
                to="/menu"
                hash={`cat-${slugify(c.name)}`}
                className="group rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-accent hover:shadow-md"
              >
                <Utensils className="mb-3 h-5 w-5 text-accent" />
                <div className="font-display text-xl text-primary">
                  {c.name}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {c.sections.length} sections · {count} items
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl text-primary">{n}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
