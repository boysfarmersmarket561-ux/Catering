import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { adminQuotesQueryOptions } from "@/lib/queries";
import {
  setQuoteStatus,
  deleteQuoteFn,
  type AdminQuote,
  type AdminQuoteLine,
} from "@/server/admin-quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUSES = ["new", "contacted", "won", "lost", "archived"] as const;

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Sums priced lines; unpriced ("price on request") lines are reported separately. */
function computeSubtotal(lines: AdminQuoteLine[]): { subtotal: number; hasUnpriced: boolean } {
  let subtotal = 0;
  let hasUnpriced = false;
  for (const l of lines) {
    if (l.unit_amount == null) {
      hasUnpriced = true;
      continue;
    }
    subtotal += Number(l.unit_amount) * l.quantity;
  }
  return { subtotal, hasUnpriced };
}

function useQuoteAction<TInput, TOutput>(fn: (opts: { data: TInput }) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-quotes"] }),
    onError: (error: Error) => toast.error(error.message),
  });
}

function QuoteDetailDialog({ quote, onClose }: { quote: AdminQuote; onClose: () => void }) {
  const { subtotal, hasUnpriced } = computeSubtotal(quote.quote_lines);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-xl">{quote.reference}</span>
            {quote.status === "new" && <Badge>New</Badge>}
            {quote.email_status === "failed" && <Badge variant="destructive">Email failed</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-1 text-sm">
          <div>
            <span className="font-medium">{quote.customer_name}</span>
          </div>
          <div>
            <a href={`mailto:${quote.customer_email}`} className="text-primary underline">
              {quote.customer_email}
            </a>
          </div>
          {quote.customer_phone && (
            <div>
              <a href={`tel:${quote.customer_phone}`} className="text-primary underline">
                {quote.customer_phone}
              </a>
            </div>
          )}
          {quote.event_date && (
            <div className="text-muted-foreground">Event date: {quote.event_date}</div>
          )}
          {quote.guest_count && (
            <div className="text-muted-foreground">Guests: {quote.guest_count}</div>
          )}
          {quote.notes && (
            <div className="mt-2 rounded-md border bg-muted/40 p-2 text-muted-foreground">
              {quote.notes}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Items</div>
          <div className="divide-y rounded-md border">
            {quote.quote_lines.map((line) => {
              const amount = line.unit_amount == null ? null : Number(line.unit_amount);
              const lineTotal = amount == null ? null : amount * line.quantity;
              return (
                <div key={line.id} className="flex items-center gap-2 p-2 text-sm">
                  <div className="flex-1">
                    <div>{line.item_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.category_name} — {line.section_name}
                      {line.tier_label ? ` — ${line.tier_label}` : ""}
                    </div>
                  </div>
                  <div className="w-12 text-right text-muted-foreground">×{line.quantity}</div>
                  <div className="w-24 text-right font-medium">
                    {lineTotal == null ? "On request" : money(lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 text-sm font-semibold">
            Subtotal: {money(subtotal)}
            {hasUnpriced && " +"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteInbox() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: quotes } = useSuspenseQuery(adminQuotesQueryOptions(includeArchived));
  const [detail, setDetail] = useState<AdminQuote | null>(null);

  const doSetStatus = useQuoteAction(setQuoteStatus);
  const doDelete = useQuoteAction(deleteQuoteFn);

  const handleDelete = (q: AdminQuote) => {
    const ok = window.confirm(`Delete quote ${q.reference}? This cannot be undone.`);
    if (ok) doDelete.mutate({ id: q.id });
  };

  return (
    <div className="space-y-4 py-6">
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">Show archived</span>
        <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} />
      </div>

      {quotes.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No quotes yet.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {quotes.map((q) => {
            const { subtotal, hasUnpriced } = computeSubtotal(q.quote_lines);
            return (
              <div key={q.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <button
                  type="button"
                  onClick={() => setDetail(q)}
                  className="font-mono text-base font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {q.reference}
                </button>
                {q.status === "new" && <Badge>New</Badge>}
                {q.email_status === "failed" && <Badge variant="destructive">Email failed</Badge>}
                <div className="flex-1 min-w-[10rem]">
                  <div className="font-medium">{q.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {q.quote_lines.length} item{q.quote_lines.length === 1 ? "" : "s"}
                </div>
                <div className="w-28 text-right font-semibold">
                  {money(subtotal)}
                  {hasUnpriced && "+"}
                </div>
                <Select
                  value={q.status}
                  onValueChange={(status) =>
                    doSetStatus.mutate({ id: q.id, status: status as AdminQuote["status"] })
                  }
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(q)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {detail && <QuoteDetailDialog quote={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
