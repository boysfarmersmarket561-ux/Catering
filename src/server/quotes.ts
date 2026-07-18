import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase.server";
import { resolveQuoteLines, type QuoteItemRow } from "@/lib/quote-lines";
import { makeReference } from "@/lib/quote-reference";
import { allowRequest } from "@/lib/rate-limit.server";
import { getEmailSender } from "@/lib/email";
import {
  businessNotificationEmail,
  customerConfirmationEmail,
  type QuoteEmailData,
} from "@/lib/email/templates";

export const SubmitQuoteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Lowercased so addresses stay consistent for lookup and for providers that
  // match recipients case-sensitively.
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((s) => s.toLowerCase()),
  phone: z.string().trim().max(50).default(""),
  eventDate: z.string().trim().max(50).default(""),
  guestCount: z.string().trim().max(50).default(""),
  notes: z.string().trim().max(5000).default(""),
  website: z.string().max(0), // honeypot — real users never fill it
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        tierId: z.string().uuid().nullable(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(200),
});

const ITEM_SELECT =
  "id,name,active,section:sections(name,active,category:categories(name,active)),price_tiers(id,label,amount,unit)";

export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator(SubmitQuoteSchema)
  .handler(async ({ data }): Promise<{ reference: string }> => {
    const ip = getRequestIP() ?? "unknown";
    if (!allowRequest(`quote:${ip}`)) {
      throw new Error("Too many quote requests from this connection — please try again later.");
    }

    const sb = supabaseAdmin();
    const itemIds = [...new Set(data.lines.map((l) => l.itemId))];
    const { data: itemRows, error: itemErr } = await sb
      .from("items")
      .select(ITEM_SELECT)
      .in("id", itemIds);
    if (itemErr) throw new Error(`submitQuote items: ${itemErr.message}`);

    const { lines, subtotal, hasUnpriced } = resolveQuoteLines(
      (itemRows ?? []) as unknown as QuoteItemRow[],
      data.lines,
    );
    if (lines.length === 0) {
      throw new Error("None of the requested items are available — please rebuild your quote.");
    }

    const reference = makeReference();
    const { data: quote, error: qErr } = await sb
      .from("quotes")
      .insert({
        reference,
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone || null,
        event_date: data.eventDate || null,
        guest_count: data.guestCount || null,
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (qErr) throw new Error(`submitQuote insert: ${qErr.message}`);

    const { error: lErr } = await sb.from("quote_lines").insert(
      lines.map((l) => ({
        quote_id: quote.id,
        item_id: l.itemId,
        item_name: l.itemName,
        category_name: l.categoryName,
        section_name: l.sectionName,
        tier_label: l.tierLabel,
        unit: l.unit,
        unit_amount: l.unitAmount,
        quantity: l.quantity,
      })),
    );
    if (lErr) throw new Error(`submitQuote lines: ${lErr.message}`);

    // Quote is committed — email failures must not lose it.
    const emailData: QuoteEmailData = {
      reference,
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone,
      eventDate: data.eventDate,
      guestCount: data.guestCount,
      notes: data.notes,
      lines,
      subtotal,
      hasUnpriced,
    };
    let emailStatus: "sent" | "failed" = "sent";
    try {
      const sender = getEmailSender();
      const { data: settings } = await sb
        .from("settings")
        .select("notification_email")
        .eq("id", 1)
        .single();
      const notifyTo = settings?.notification_email?.trim().toLowerCase();
      if (!notifyTo) throw new Error("settings.notification_email missing");
      const biz = businessNotificationEmail(emailData);
      await sender.send({ to: notifyTo, ...biz });
      const cust = customerConfirmationEmail(emailData);
      await sender.send({ to: data.email, ...cust });
    } catch (e) {
      console.error(`quote ${reference}: email failed`, e);
      emailStatus = "failed";
    }
    await sb.from("quotes").update({ email_status: emailStatus }).eq("id", quote.id);

    return { reference };
  });
