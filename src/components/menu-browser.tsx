import { useEffect, useMemo, useState } from "react";
import type { MenuData, MenuItem } from "@/data/menu";
import { formatPrice, isPriced, itemId } from "@/data/menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Check, Users, Ruler } from "lucide-react";
import { useCart } from "@/lib/menu-store";
import { toast } from "sonner";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Props {
  data: MenuData;
}

export function MenuBrowser({ data }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("all");
  const { addLine, cart } = useCart();

  useEffect(() => {
    // scroll to hash on load
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.categories
      .filter((c) => active === "all" || c.name === active)
      .map((c) => ({
        ...c,
        sections: c.sections
          .map((s) => ({
            ...s,
            items: s.items.filter((it) => {
              if (!q) return true;
              return (
                it.name.toLowerCase().includes(q) ||
                (it.description ?? "").toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q)
              );
            }),
          }))
          .filter((s) => s.items.length > 0),
      }))
      .filter((c) => c.sections.length > 0);
  }, [data, query, active]);

  const totalShown = filtered.reduce(
    (n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0),
    0,
  );

  const inCart = (id: string) => cart.some((l) => l.id === id);

  return (
    <div>
      <div className="sticky top-[80px] z-30 -mx-4 mb-10 border-b border-border/60 bg-background/90 px-4 py-5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all 230+ items…"
              className="h-14 rounded-full border-primary/20 bg-card pl-12 text-base"
            />
          </div>
          <span className="text-sm text-muted-foreground">{totalShown} items</span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <CategoryChip label="All" active={active === "all"} onClick={() => setActive("all")} />
          {data.categories.map((c) => (
            <CategoryChip
              key={c.name}
              label={c.name}
              active={active === c.name}
              onClick={() => setActive(c.name)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-lg text-muted-foreground">
          No items match "{query}".
        </div>
      )}

      {filtered.map((cat) => (
        <section key={cat.name} id={`cat-${slugify(cat.name)}`} className="mb-20 scroll-mt-56">
          <div className="mb-6 flex items-baseline gap-4 border-b border-primary/20 pb-3">
            <h2 className="font-display text-4xl text-primary md:text-5xl">{cat.name}</h2>
            <span className="text-base text-muted-foreground">
              {cat.sections.reduce((n, s) => n + s.items.length, 0)} items
            </span>
          </div>
          {cat.sections.map((sec) => (
            <div key={sec.name} className="mb-14">
              <h3 className="font-display text-2xl text-foreground md:text-3xl">{sec.name}</h3>
              {sec.note && <p className="mt-2 max-w-2xl text-base italic text-muted-foreground">{sec.note}</p>}
              <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {sec.items.map((it) => {
                  const id = itemId(cat.name, sec.name, it.name);
                  return (
                    <ItemCard
                      key={id}
                      id={id}
                      category={cat.name}
                      section={sec.name}
                      item={it}
                      inCart={inCart(id)}
                      onAdd={(priceIndex) => {
                        const p = it.prices[priceIndex];
                        addLine({
                          id,
                          category: cat.name,
                          section: sec.name,
                          name: it.name,
                          priceIndex,
                          priceLabel: p ? formatPrice(p) : "Price on request",
                          unitAmount: p?.amount ?? null,
                        });
                        toast.success(`Added ${it.name} to your quote`);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "whitespace-nowrap rounded-full border px-5 py-2 text-base font-medium transition " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:text-primary")
      }
    >
      {label}
    </button>
  );
}

function ItemCard({
  id,
  item,
  inCart,
  onAdd,
}: {
  id: string;
  category: string;
  section: string;
  item: MenuItem;
  inCart: boolean;
  onAdd: (priceIndex: number) => void;
}) {
  const priced = isPriced(item);
  return (
    <article className="group flex flex-col rounded-2xl border border-border/70 bg-card p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-display text-2xl leading-snug text-foreground">{item.name}</h4>
        {!priced && (
          <Badge variant="outline" className="border-accent/50 text-accent text-sm">
            On request
          </Badge>
        )}
      </div>
      {item.description && (
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{item.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        {item.size && (
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" /> {item.size}
          </span>
        )}
        {item.serves && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" /> {item.serves}
          </span>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {item.prices.length === 0 && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
            <span className="text-base font-medium">Price on request</span>
            <Button size="sm" variant="ghost" onClick={() => onAdd(0)}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        )}
        {item.prices.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3"
          >
            <div>
              {p.label && <div className="text-sm text-muted-foreground">{p.label}</div>}
              <div className="text-lg font-semibold text-foreground">{formatPrice(p)}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onAdd(i)}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        ))}
      </div>
      {inCart && (
        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
          <Check className="h-4 w-4" /> In your quote
        </div>
      )}
    </article>
  );
}