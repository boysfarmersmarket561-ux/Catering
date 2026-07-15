import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useMenu,
  flattenMenu,
  updateItem,
  resetMenu,
  useQuotes,
  deleteQuote,
  type FlatItem,
} from "@/lib/menu-store";
import { formatPrice, isPriced, type Price, type PriceUnit } from "@/data/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, LockKeyhole, LogOut, Plus, RotateCcw, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — The Boys Catering" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

// Default staff passcode. Note: this is a client-side gate only — replace with real auth later.
const DEFAULT_PASSCODE = "boys2024";
const AUTH_KEY = "boys-admin-auth-v1";

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(sessionStorage.getItem(AUTH_KEY) === "1");
  }, []);

  if (!authed) return <PasscodeGate onUnlock={() => setAuthed(true)} />;
  return <AdminDashboard onLock={() => setAuthed(false)} />;
}

function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === DEFAULT_PASSCODE) {
            sessionStorage.setItem(AUTH_KEY, "1");
            onUnlock();
          } else {
            setError(true);
          }
        }}
        className="w-full space-y-4 rounded-3xl border border-border/70 bg-card p-8 shadow-sm"
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl">Staff area</h1>
          <p className="text-sm text-muted-foreground">Enter the staff passcode to continue.</p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Passcode</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-destructive">Incorrect passcode.</p>}
        </div>
        <Button type="submit" className="w-full rounded-full">
          Unlock
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Default passcode: <span className="font-mono">boys2024</span> — replace before going live.
        </p>
      </form>
    </div>
  );
}

function AdminDashboard({ onLock }: { onLock: () => void }) {
  const menu = useMenu();
  const flat = useMemo(() => flattenMenu(menu), [menu]);
  const quotes = useQuotes();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Catering Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage menu items, prices, and quote requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              if (confirm("Reset all menu edits to the original menu?")) {
                resetMenu();
                toast.success("Menu reset to original data.");
              }
            }}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Reset menu
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              sessionStorage.removeItem(AUTH_KEY);
              onLock();
            }}
          >
            <LogOut className="mr-1 h-4 w-4" /> Lock
          </Button>
        </div>
      </div>

      <Stats flat={flat} quotes={quotes.length} />

      <Tabs defaultValue="items" className="mt-8">
        <TabsList>
          <TabsTrigger value="items">Menu items</TabsTrigger>
          <TabsTrigger value="quotes">Quote requests ({quotes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-6">
          <ItemsTable flat={flat} />
        </TabsContent>
        <TabsContent value="quotes" className="mt-6">
          <QuotesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stats({ flat, quotes }: { flat: FlatItem[]; quotes: number }) {
  const priced = flat.filter((f) => isPriced(f.item)).length;
  const unpriced = flat.length - priced;
  const amounts = flat.flatMap((f) => f.item.prices.map((p) => p.amount ?? NaN)).filter((n) => !isNaN(n));
  const cheapest = amounts.length ? Math.min(...amounts) : 0;
  const priciest = amounts.length ? Math.max(...amounts) : 0;
  const byCat = flat.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total items" value={flat.length.toString()} />
      <StatCard label="Priced / on request" value={`${priced} / ${unpriced}`} tone={unpriced ? "warn" : undefined} />
      <StatCard label="Cheapest" value={`$${cheapest.toFixed(2)}`} />
      <StatCard label="Priciest" value={`$${priciest.toFixed(2)}`} />
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:col-span-2 lg:col-span-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Items per category</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byCat).map(([c, n]) => (
            <Badge key={c} variant="secondary" className="rounded-full">
              {c} · {n}
            </Badge>
          ))}
          <Badge variant="outline" className="rounded-full border-accent/50 text-accent">
            {quotes} quote request{quotes === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={"mt-1 font-display text-3xl " + (tone === "warn" ? "text-accent" : "text-primary")}>
        {value}
      </div>
    </div>
  );
}

type SortKey = "category" | "section" | "name" | "priced";

function ItemsTable({ flat }: { flat: FlatItem[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [editing, setEditing] = useState<FlatItem | null>(null);

  const cats = Array.from(new Set(flat.map((f) => f.category)));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = flat.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (onlyUnpriced && isPriced(f.item)) return false;
      if (!needle) return true;
      return (
        f.item.name.toLowerCase().includes(needle) ||
        (f.item.description ?? "").toLowerCase().includes(needle) ||
        f.section.toLowerCase().includes(needle)
      );
    });
    r = [...r].sort((a, b) => {
      if (sortKey === "priced") return Number(isPriced(a.item)) - Number(isPriced(b.item));
      const av = (a as unknown as Record<string, string>)[sortKey] ?? a.item.name;
      const bv = (b as unknown as Record<string, string>)[sortKey] ?? b.item.name;
      if (sortKey === "name") return a.item.name.localeCompare(b.item.name);
      return av.localeCompare(bv);
    });
    return r;
  }, [flat, q, cat, onlyUnpriced, sortKey]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items…"
          className="max-w-sm rounded-full"
        />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-56 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnpriced}
            onChange={(e) => setOnlyUnpriced(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Only unpriced
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th onClick={() => setSortKey("category")}>Category</Th>
              <Th onClick={() => setSortKey("section")}>Section</Th>
              <Th onClick={() => setSortKey("name")}>Item</Th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Size · serves</th>
              <th className="px-3 py-2">Prices</th>
              <Th onClick={() => setSortKey("priced")}>Status</Th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const priced = isPriced(row.item);
              return (
                <tr key={row.id} className={priced ? "" : "bg-accent/5"}>
                  <td className="px-3 py-2 align-top">{row.category}</td>
                  <td className="px-3 py-2 align-top">{row.section}</td>
                  <td className="px-3 py-2 align-top font-medium">{row.item.name}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{row.item.description}</td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {row.item.size}
                    {row.item.serves && <div>{row.item.serves}</div>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.item.prices.length === 0 ? (
                      <span className="text-xs italic text-accent">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.item.prices.map((p, i) => (
                          <li key={i} className="text-xs">
                            {p.label ? <span className="text-muted-foreground">{p.label}: </span> : null}
                            {formatPrice(p)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {priced ? (
                      <Badge variant="secondary">Priced</Badge>
                    ) : (
                      <Badge className="bg-accent text-accent-foreground">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Unpriced
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th className="cursor-pointer select-none px-3 py-2 hover:text-primary" onClick={onClick}>
      {children}
    </th>
  );
}

const UNITS: PriceUnit[] = [
  "platter",
  "per_person",
  "per_lb",
  "per_foot",
  "each",
  "per_kabob",
  "per_pastry",
  "per_pieces",
  "unpriced",
];

function EditDialog({ row, onClose }: { row: FlatItem; onClose: () => void }) {
  const [name, setName] = useState(row.item.name);
  const [description, setDescription] = useState(row.item.description ?? "");
  const [size, setSize] = useState(row.item.size ?? "");
  const [serves, setServes] = useState(row.item.serves ?? "");
  const [prices, setPrices] = useState<Price[]>(
    row.item.prices.length ? row.item.prices : [],
  );

  const setPrice = (i: number, patch: Partial<Price>) =>
    setPrices((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const save = () => {
    updateItem(row.id, {
      name,
      description,
      size,
      serves,
      prices: prices.map((p) => ({
        label: p.label || null,
        amount: p.amount === null || Number.isNaN(p.amount) ? null : Number(p.amount),
        unit: p.unit,
      })),
    });
    toast.success("Item updated.");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit — <span className="text-muted-foreground">{row.category} / {row.section}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Size</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div>
              <Label>Serves</Label>
              <Input value={serves} onChange={(e) => setServes(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Price tiers</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setPrices((ps) => [...ps, { label: null, amount: 0, unit: "platter" }])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
              </Button>
            </div>
            <div className="space-y-2">
              {prices.length === 0 && (
                <p className="text-sm italic text-muted-foreground">No price tiers — item will show "Price on request".</p>
              )}
              {prices.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_140px_36px] gap-2">
                  <Input
                    placeholder="Label (optional)"
                    value={p.label ?? ""}
                    onChange={(e) => setPrice(i, { label: e.target.value || null })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={p.amount ?? ""}
                    onChange={(e) =>
                      setPrice(i, { amount: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                  <Select value={p.unit} onValueChange={(v) => setPrice(i, { unit: v as PriceUnit })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setPrices((ps) => ps.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotesList() {
  const quotes = useQuotes();
  if (quotes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        No quote requests yet.
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {quotes.map((q) => (
        <li key={q.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg">{q.name}</div>
              <div className="text-xs text-muted-foreground">
                #{q.id.slice(0, 8).toUpperCase()} · {new Date(q.createdAt).toLocaleString()}
              </div>
              <div className="mt-2 text-sm">
                <a href={`mailto:${q.email}`} className="hover:underline">
                  {q.email}
                </a>
                {q.phone && <> · {q.phone}</>}
              </div>
              <div className="text-xs text-muted-foreground">
                Event: {q.eventDate || "—"} · Guests: {q.guestCount || "—"}
              </div>
              {q.notes && <p className="mt-2 max-w-xl text-sm italic text-muted-foreground">"{q.notes}"</p>}
            </div>
            <div className="text-right">
              <div className="font-display text-2xl text-primary">${q.subtotal.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{q.lines.length} items</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this quote request?")) deleteQuote(q.id);
                }}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              View items
            </summary>
            <ul className="mt-2 divide-y divide-border/60 text-sm">
              {q.lines.map((l, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span>
                    {l.quantity} × {l.name}
                    <span className="text-xs text-muted-foreground"> — {l.category}</span>
                  </span>
                  <span className="font-medium">{l.priceLabel}</span>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}