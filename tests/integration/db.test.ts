import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// These tests exercise real schema behaviour (cascades, quote-line snapshot
// survival, uniqueness constraints) against a LOCAL Supabase instance. They
// create and delete rows, so they must NEVER run against production.
//
// Set both env vars to run: TEST_SUPABASE_URL=http://127.0.0.1:54321
// TEST_SUPABASE_SECRET_KEY=<from `npx supabase start`>
//
// These are deliberately named TEST_* — distinct from the production
// SUPABASE_URL / SUPABASE_SECRET_KEY — so production credentials can never
// accidentally point these tests at the live database. Without both vars
// set, the whole suite is skipped and `npm test` stays green with no
// Docker/Supabase dependency.
const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_SECRET_KEY;

describe.skipIf(!url || !key)("supabase schema integration", () => {
  let sb: SupabaseClient;
  beforeAll(() => {
    sb = createClient(url!, key!, { auth: { persistSession: false } });
  });

  it("catalogue CRUD cascades category → section → item → tier", async () => {
    const { data: cat } = await sb
      .from("categories")
      .insert({ name: "IT Cat" })
      .select("id")
      .single();
    const { data: sec } = await sb
      .from("sections")
      .insert({ category_id: cat!.id, name: "IT Sec" })
      .select("id")
      .single();
    const { data: item } = await sb
      .from("items")
      .insert({ section_id: sec!.id, name: "IT Item" })
      .select("id")
      .single();
    await sb
      .from("price_tiers")
      .insert({ item_id: item!.id, label: "Sm", amount: 5, unit: "each" });

    await sb.from("categories").delete().eq("id", cat!.id);
    const { data: orphans } = await sb.from("items").select("id").eq("id", item!.id);
    expect(orphans).toHaveLength(0); // cascade wiped the whole subtree
  });

  it("quote lines keep snapshots when the item is deleted (SET NULL)", async () => {
    const { data: cat } = await sb
      .from("categories")
      .insert({ name: "IT Cat2" })
      .select("id")
      .single();
    const { data: sec } = await sb
      .from("sections")
      .insert({ category_id: cat!.id, name: "S" })
      .select("id")
      .single();
    const { data: item } = await sb
      .from("items")
      .insert({ section_id: sec!.id, name: "Doomed Platter" })
      .select("id")
      .single();
    const { data: quote } = await sb
      .from("quotes")
      .insert({
        reference: `IT${Date.now().toString(36).slice(-6).toUpperCase()}`,
        customer_name: "T",
        customer_email: "t@example.com",
      })
      .select("id")
      .single();
    await sb.from("quote_lines").insert({
      quote_id: quote!.id,
      item_id: item!.id,
      item_name: "Doomed Platter",
      category_name: "IT Cat2",
      section_name: "S",
      unit_amount: 42.5,
      quantity: 2,
    });

    await sb.from("categories").delete().eq("id", cat!.id); // deletes the item via cascade
    const { data: lines } = await sb.from("quote_lines").select("*").eq("quote_id", quote!.id);
    expect(lines).toHaveLength(1);
    expect(lines![0].item_id).toBeNull();
    expect(lines![0].item_name).toBe("Doomed Platter"); // snapshot survives
    await sb.from("quotes").delete().eq("id", quote!.id);
  });

  it("quotes.reference is unique", async () => {
    const ref = `ITDUP${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const row = { reference: ref, customer_name: "T", customer_email: "t@example.com" };
    const first = await sb.from("quotes").insert(row);
    expect(first.error).toBeNull();
    const dup = await sb.from("quotes").insert(row);
    expect(dup.error).not.toBeNull();
    await sb.from("quotes").delete().eq("reference", ref);
  });
});
