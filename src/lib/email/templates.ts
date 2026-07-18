import type { EmailContent } from "./types";
import type { ResolvedLine } from "@/lib/quote-lines";

export interface QuoteEmailData {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventDate: string;
  guestCount: string;
  notes: string;
  lines: ResolvedLine[];
  subtotal: number;
  hasUnpriced: boolean;
}

const money = (n: number) => `$${n.toFixed(2)}`;

function lineParts(l: ResolvedLine): { qty: string; name: string; price: string } {
  return {
    qty: `${l.quantity}`,
    name: l.tierLabel ? `${l.itemName} (${l.tierLabel})` : l.itemName,
    price:
      l.unitAmount == null
        ? "Price on request"
        : `${money(l.unitAmount)} ea — ${money(l.unitAmount * l.quantity)}`,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linesText(lines: ResolvedLine[]): string {
  return lines
    .map((l) => {
      const p = lineParts(l);
      return `• ${p.name} × ${p.qty} — ${p.price}`;
    })
    .join("\n");
}

function linesHtml(lines: ResolvedLine[]): string {
  const rows = lines
    .map((l) => {
      const p = lineParts(l);
      return (
        `<tr><td style="padding:6px 12px 6px 0">${esc(p.name)} &times; ${p.qty}</td>` +
        `<td style="padding:6px 0;text-align:right">${esc(p.price)}</td></tr>`
      );
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%">${rows}</table>`;
}

function detailsText(d: QuoteEmailData): string {
  return [
    `Name: ${d.customerName}`,
    `Email: ${d.customerEmail}`,
    `Phone: ${d.customerPhone || "—"}`,
    `Event date: ${d.eventDate || "—"}`,
    `Guests: ${d.guestCount || "—"}`,
    `Notes: ${d.notes || "—"}`,
  ].join("\n");
}

function subtotalText(d: QuoteEmailData): string {
  return `Estimated subtotal: ${money(d.subtotal)}${d.hasUnpriced ? " (plus items priced on request)" : ""}`;
}

export function businessNotificationEmail(d: QuoteEmailData): EmailContent {
  const subject = `New catering quote ${d.reference} — ${d.customerName}`;
  const text = [
    `New quote request ${d.reference}`,
    "",
    linesText(d.lines),
    "",
    subtotalText(d),
    "",
    detailsText(d),
  ].join("\n");
  const html =
    `<h2>New quote request ${d.reference}</h2>` +
    linesHtml(d.lines) +
    `<p><strong>${esc(subtotalText(d))}</strong></p>` +
    `<pre style="font-family:inherit">${esc(detailsText(d))}</pre>`;
  return { subject, html, text };
}

export function customerConfirmationEmail(d: QuoteEmailData): EmailContent {
  const subject = `The Boys Farmers Market — quote request ${d.reference} received`;
  const intro =
    `Hi ${d.customerName},\n\nThanks for your catering quote request! ` +
    `Your reference is ${d.reference}. We'll follow up within one business day ` +
    `to confirm availability and final pricing.`;
  const outro =
    `The subtotal is an estimate; items priced on request are quoted when we confirm.\n\n` +
    `The Boys Farmers Market — Gourmet Catering\n14378 S. Military Trail, Delray Beach, FL 33484\n(561) 496-0810 Ext. 1`;
  const text = [intro, "", linesText(d.lines), "", subtotalText(d), "", outro].join("\n");
  const html =
    `<p>${esc(intro).replace(/\n/g, "<br>")}</p>` +
    linesHtml(d.lines) +
    `<p><strong>${esc(subtotalText(d))}</strong></p>` +
    `<p>${esc(outro).replace(/\n/g, "<br>")}</p>`;
  return { subject, html, text };
}
