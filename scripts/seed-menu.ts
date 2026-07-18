import { createClient } from "@supabase/supabase-js";
import menu from "../src/data/menu.json";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const VALID_UNITS = new Set([
  "platter",
  "per_person",
  "per_lb",
  "per_foot",
  "each",
  "per_kabob",
  "per_pastry",
  "per_pieces",
]);

async function main() {
  console.log("Wiping catalogue…");
  await sb.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let nCat = 0,
    nSec = 0,
    nItem = 0,
    nTier = 0;
  for (const [ci, cat] of menu.categories.entries()) {
    const { data: c, error: ce } = await sb
      .from("categories")
      .insert({ name: cat.name, sort_order: ci })
      .select("id")
      .single();
    if (ce) throw new Error(`category ${cat.name}: ${ce.message}`);
    nCat++;
    for (const [si, sec] of cat.sections.entries()) {
      const { data: s, error: se } = await sb
        .from("sections")
        .insert({ category_id: c.id, name: sec.name, note: sec.note ?? null, sort_order: si })
        .select("id")
        .single();
      if (se) throw new Error(`section ${sec.name}: ${se.message}`);
      nSec++;
      for (const [ii, it] of sec.items.entries()) {
        const { data: item, error: ie } = await sb
          .from("items")
          .insert({
            section_id: s.id,
            name: it.name,
            description: it.description ?? null,
            size: it.size ?? null,
            serves: it.serves ?? null,
            sort_order: ii,
          })
          .select("id")
          .single();
        if (ie) throw new Error(`item ${it.name}: ${ie.message}`);
        nItem++;
        const tiers = (it.prices ?? []).map((p, ti) => ({
          item_id: item.id,
          label: p.label ?? null,
          amount: p.amount,
          unit: VALID_UNITS.has(p.unit) ? p.unit : "each",
          sort_order: ti,
        }));
        if (tiers.length) {
          const { error: te } = await sb.from("price_tiers").insert(tiers);
          if (te) throw new Error(`tiers for ${it.name}: ${te.message}`);
          nTier += tiers.length;
        }
      }
    }
  }

  const { error: se2 } = await sb.from("settings").upsert({
    id: 1,
    notification_email: menu.business.bakery_email,
    store_hours: ["Monday – Sunday 8:30am – 6:00pm"],
    facebook_url: null,
    instagram_url: null,
    site_origin: process.env.SITE_ORIGIN ?? null,
  });
  if (se2) throw new Error(`settings: ${se2.message}`);

  console.log(`Seeded ${nCat} categories, ${nSec} sections, ${nItem} items, ${nTier} tiers.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
