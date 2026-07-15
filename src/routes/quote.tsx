import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCart, saveQuote } from "@/lib/menu-store";
import { baseMenu } from "@/data/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Minus, Plus, Mail, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quote")({
  head: () => ({
    meta: [
      { title: "Build a Quote — The Boys Farmers Market Catering" },
      {
        name: "description",
        content:
          "Assemble your catering order and request a quote. We'll confirm availability, pricing, and delivery.",
      },
      { property: "og:title", content: "Build a Quote — The Boys Farmers Market" },
      {
        property: "og:description",
        content: "Add items to a quote and submit — we'll follow up to finalize your order.",
      },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { cart, setQty, remove, subtotal, hasUnpriced, clear } = useCart();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    guestCount: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState<null | { ref: string }>(null);
  const b = baseMenu.business;

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error("Add at least one item to your quote first.");
      return;
    }
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    const q = saveQuote({ ...form, lines: cart, subtotal });
    setSubmitted({ ref: q.id.slice(0, 8).toUpperCase() });
  };

  const mailtoBody = () => {
    const lines = cart
      .map((l) => `• ${l.quantity} × ${l.name} — ${l.priceLabel}`)
      .join("\n");
    const body = `Hello ${b.name},\n\nI'd like to request a catering quote:\n\n${lines}\n\nEstimated subtotal: $${subtotal.toFixed(2)}${hasUnpriced ? " (plus items priced on request)" : ""}\n\nName: ${form.name}\nPhone: ${form.phone}\nEvent date: ${form.eventDate}\nGuest count: ${form.guestCount}\nNotes: ${form.notes}\n\nThank you!`;
    return encodeURIComponent(body);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
          ✓
        </div>
        <h1 className="font-display text-4xl">Quote request received</h1>
        <p className="mt-3 text-muted-foreground">
          Reference <span className="font-mono font-semibold">#{submitted.ref}</span>. We'll be in touch shortly.
          You can also email or print your request below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" className="rounded-full">
            <a href={`mailto:${b.bakery_email}?subject=Catering%20Quote%20Request&body=${mailtoBody()}`}>
              <Mail className="mr-1 h-4 w-4" /> Email a copy
            </a>
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="rounded-full">
            <Printer className="mr-1 h-4 w-4" /> Print summary
          </Button>
          <Button
            asChild
            className="rounded-full"
            onClick={() => {
              clear();
              setSubmitted(null);
            }}
          >
            <Link to="/menu">Back to menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">Your quote</span>
        <h1 className="mt-1 font-display text-5xl">Build a Quote</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Review your selected items and share your event details. We'll follow up to confirm availability and
          finalize pricing.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Cart */}
        <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl">Selected items ({cart.length})</h2>
          {cart.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">Your quote is empty.</p>
              <Button asChild className="mt-4 rounded-full">
                <Link to="/menu">Browse the menu</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {cart.map((l) => (
                <li key={`${l.id}-${l.priceIndex}`} className="flex items-center gap-4 py-4">
                  <div className="flex-1">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.category} · {l.section}
                    </div>
                    <div className="mt-0.5 text-sm">{l.priceLabel}</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border bg-background">
                    <button
                      className="grid h-8 w-8 place-items-center hover:text-primary"
                      onClick={() => setQty(l.id, l.priceIndex, l.quantity - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{l.quantity}</span>
                    <button
                      className="grid h-8 w-8 place-items-center hover:text-primary"
                      onClick={() => setQty(l.id, l.priceIndex, l.quantity + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-24 text-right font-semibold">
                    {l.unitAmount == null ? (
                      <span className="text-xs text-accent">On request</span>
                    ) : (
                      `$${(l.unitAmount * l.quantity).toFixed(2)}`
                    )}
                  </div>
                  <button
                    onClick={() => remove(l.id, l.priceIndex)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-sm text-muted-foreground">
                Estimated subtotal{hasUnpriced ? " (excl. items on request)" : ""}
              </span>
              <span className="font-display text-2xl text-primary">${subtotal.toFixed(2)}</span>
            </div>
          )}
        </section>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-sm"
        >
          <h2 className="font-display text-2xl">Your details</h2>
          <div className="grid gap-4">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={100} />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
                maxLength={255}
              />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} maxLength={40} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event date">
                <Input type="date" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} />
              </Field>
              <Field label="Guests">
                <Input
                  type="number"
                  min={1}
                  value={form.guestCount}
                  onChange={(e) => update("guestCount", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                maxLength={1000}
                placeholder="Dietary needs, delivery, timing…"
              />
            </Field>
          </div>
          <Button type="submit" size="lg" className="w-full rounded-full">
            Submit quote request
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We'll email a confirmation and follow-up within one business day.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-accent">*</span>}
      </Label>
      {children}
    </div>
  );
}