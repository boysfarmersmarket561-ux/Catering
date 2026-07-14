import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { baseMenu } from "@/data/menu";
import { ArrowRight, Leaf, Sparkles, Utensils } from "lucide-react";

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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,theme(colors.accent/25),transparent_60%),radial-gradient(ellipse_at_bottom_left,theme(colors.primary/20),transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary-foreground">
              <Leaf className="h-3.5 w-3.5" /> Delray Beach, FL
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-foreground md:text-6xl lg:text-7xl">
              Gourmet catering,<br />
              <span className="text-primary">market-fresh</span> flavor.
            </h1>
            <p className="mt-6 max-w-lg text-lg italic text-muted-foreground">
              {b.tagline}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/menu">
                  Browse the Menu <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-primary/40 text-primary hover:bg-primary/10">
                <Link to="/quote">Request a Quote</Link>
              </Button>
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              <div>
                <div className="font-display text-3xl text-primary">230+</div>
                <div className="text-muted-foreground">Handcrafted items</div>
              </div>
              <div>
                <div className="font-display text-3xl text-primary">8</div>
                <div className="text-muted-foreground">Menu categories</div>
              </div>
              <div>
                <div className="font-display text-3xl text-primary">7</div>
                <div className="text-muted-foreground">Days a week</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {categories.slice(0, 4).map((c, i) => (
                <Link
                  key={c.name}
                  to="/menu"
                  hash={`cat-${slugify(c.name)}`}
                  className={
                    "group flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg " +
                    (i % 2 === 0 ? "md:translate-y-6" : "")
                  }
                >
                  <Utensils className="h-6 w-6 text-accent" />
                  <div>
                    <div className="mt-8 font-display text-xl text-foreground group-hover:text-primary">
                      {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.sections.reduce((n, s) => n + s.items.length, 0)} items
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
                className="group rounded-2xl border border-border/60 bg-card p-5 transition hover:border-primary/60 hover:shadow-md"
              >
                <div className="font-display text-xl text-foreground group-hover:text-primary">
                  {c.name}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
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
