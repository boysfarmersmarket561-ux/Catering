import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { catalogQueryOptions } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Sparkles, Utensils } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions()),
  component: Index,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Index() {
  const { data } = useSuspenseQuery(catalogQueryOptions());
  const categories = data;
  const itemCount = categories.reduce(
    (n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0),
    0,
  );
  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-32 lg:px-8">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            <MapPin className="h-4 w-4" /> Delray Beach, FL
          </span>
          <h1 className="mt-6 font-display text-6xl leading-[1.05] text-primary md:text-8xl lg:text-9xl">
            Catering
          </h1>
          <div className="mx-auto mt-6 h-[3px] w-32 bg-accent" />
          <p className="mx-auto mt-8 max-w-3xl text-2xl italic leading-relaxed text-muted-foreground">
            Bringing our gourmet meals from our kitchen to your table!
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/menu">
                Browse the Menu <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/quote">Request a Quote</Link>
            </Button>
          </div>
          <div className="mt-16 flex flex-wrap justify-center gap-14 text-base">
            <Stat n={`${itemCount}+`} label="Handcrafted items" />
            <Stat n={String(data.length)} label="Menu categories" />
            <Stat n="7" label="Days a week" />
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="mr-1 inline h-4 w-4" /> Explore
            </span>
            <h2 className="mt-3 font-display text-5xl md:text-6xl">Every occasion, catered.</h2>
          </div>
          <Link
            to="/menu"
            className="hidden text-base font-semibold text-primary hover:underline sm:inline"
          >
            View full menu →
          </Link>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => {
            const count = c.sections.reduce((n, s) => n + s.items.length, 0);
            return (
              <Link
                key={c.id}
                to="/menu"
                hash={`cat-${slugify(c.name)}`}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-accent hover:shadow-md"
              >
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-36 w-full object-cover"
                  />
                )}
                <div className="p-7">
                  <Utensils className="mb-4 h-6 w-6 text-accent" />
                  <div className="font-display text-2xl text-primary">{c.name}</div>
                  <div className="mt-2 text-sm uppercase tracking-wider text-muted-foreground">
                    {c.sections.length} sections · {count} items
                  </div>
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
      <div className="font-display text-5xl text-primary md:text-6xl">{n}</div>
      <div className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    </div>
  );
}
