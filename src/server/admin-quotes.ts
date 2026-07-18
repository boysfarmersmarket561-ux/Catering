import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";

export interface AdminQuoteLine {
  id: string;
  item_name: string;
  category_name: string;
  section_name: string;
  tier_label: string | null;
  unit: string | null;
  unit_amount: string | number | null;
  quantity: number;
}
export interface AdminQuote {
  id: string;
  reference: string;
  status: "new" | "contacted" | "won" | "lost" | "archived";
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_date: string | null;
  guest_count: string | null;
  notes: string | null;
  email_status: "pending" | "sent" | "failed";
  created_at: string;
  quote_lines: AdminQuoteLine[];
}

export const listQuotes = createServerFn({ method: "GET" })
  .validator(z.object({ includeArchived: z.boolean().default(false) }))
  .handler(async ({ data }): Promise<AdminQuote[]> => {
    await requireAdmin();
    let q = supabaseAdmin()
      .from("quotes")
      .select("*, quote_lines(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data.includeArchived) q = q.neq("status", "archived");
    const { data: rows, error } = await q;
    if (error) throw new Error(`listQuotes: ${error.message}`);
    return (rows ?? []) as AdminQuote[];
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "contacted", "won", "lost", "archived"]),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin()
      .from("quotes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(`setQuoteStatus: ${error.message}`);
    return { ok: true };
  });

export const deleteQuoteFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(`deleteQuote: ${error.message}`);
    return { ok: true };
  });
