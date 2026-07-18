import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin, imageBaseUrl } from "@/lib/supabase.server";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";
import { CATALOG_SELECT } from "@/server/catalog";
import { PRICE_UNITS } from "@/lib/catalog-types";
import type { CatalogCategory } from "@/lib/catalog-types";

const Id = z.object({ id: z.string().uuid() });
const Kind = z.enum(["category", "section", "item"]);
const TABLE = { category: "categories", section: "sections", item: "items" } as const;

function fail(ctx: string, message: string): never {
  throw new Error(`${ctx}: ${message}`);
}

export const getAdminCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogCategory[]> => {
    await requireAdmin();
    const { data, error } = await supabaseAdmin().from("categories").select(CATALOG_SELECT);
    if (error) fail("getAdminCatalog", error.message);
    return mapCatalogRows((data ?? []) as unknown as DbCategoryRow[], {
      includeInactive: true,
      imageBase: imageBaseUrl(),
    });
  },
);

async function nextSortOrder(
  table: string,
  filter?: { col: string; val: string },
): Promise<number> {
  let q = supabaseAdmin()
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (filter) q = q.eq(filter.col, filter.val);
  const { data } = await q;
  return data?.length ? data[0].sort_order + 1 : 0;
}

export const createCategory = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("categories");
    const { error } = await supabaseAdmin()
      .from("categories")
      .insert({ name: data.name, sort_order });
    if (error) fail("createCategory", error.message);
    return { ok: true };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .validator(
    Id.extend({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("categories").update(patch).eq("id", id);
    if (error) fail("updateCategory", error.message);
    return { ok: true };
  });

export const createSection = createServerFn({ method: "POST" })
  .validator(z.object({ categoryId: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("sections", {
      col: "category_id",
      val: data.categoryId,
    });
    const { error } = await supabaseAdmin()
      .from("sections")
      .insert({ category_id: data.categoryId, name: data.name, sort_order });
    if (error) fail("createSection", error.message);
    return { ok: true };
  });

export const updateSection = createServerFn({ method: "POST" })
  .validator(
    Id.extend({
      name: z.string().trim().min(1).max(200).optional(),
      note: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("sections").update(patch).eq("id", id);
    if (error) fail("updateSection", error.message);
    return { ok: true };
  });

export const createItem = createServerFn({ method: "POST" })
  .validator(z.object({ sectionId: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("items", { col: "section_id", val: data.sectionId });
    const { data: row, error } = await supabaseAdmin()
      .from("items")
      .insert({ section_id: data.sectionId, name: data.name, sort_order })
      .select("id")
      .single();
    if (error) fail("createItem", error.message);
    return { id: row.id as string };
  });

export const updateItemFn = createServerFn({ method: "POST" })
  .validator(
    Id.extend({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      size: z.string().max(200).nullable().optional(),
      serves: z.string().max(200).nullable().optional(),
    }),
  )
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("items").update(patch).eq("id", id);
    if (error) fail("updateItemFn", error.message);
    return { ok: true };
  });

export const deleteEntity = createServerFn({ method: "POST" })
  .validator(Id.extend({ kind: Kind }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from(TABLE[data.kind]).delete().eq("id", data.id);
    if (error) fail("deleteEntity", error.message);
    return { ok: true };
  });

export const setActive = createServerFn({ method: "POST" })
  .validator(Id.extend({ kind: Kind, active: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin()
      .from(TABLE[data.kind])
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) fail("setActive", error.message);
    return { ok: true };
  });

export const reorder = createServerFn({ method: "POST" })
  .validator(z.object({ kind: Kind, ids: z.array(z.string().uuid()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await sb
        .from(TABLE[data.kind])
        .update({ sort_order: i })
        .eq("id", data.ids[i]);
      if (error) fail("reorder", error.message);
    }
    return { ok: true };
  });

export const replaceTiers = createServerFn({ method: "POST" })
  .validator(
    z.object({
      itemId: z.string().uuid(),
      tiers: z
        .array(
          z.object({
            label: z.string().trim().max(100).nullable(),
            amount: z.number().min(0).max(100000).nullable(),
            unit: z.enum(PRICE_UNITS as [string, ...string[]]),
          }),
        )
        .max(20),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    const { error: dErr } = await sb.from("price_tiers").delete().eq("item_id", data.itemId);
    if (dErr) fail("replaceTiers delete", dErr.message);
    if (data.tiers.length) {
      const { error: iErr } = await sb.from("price_tiers").insert(
        data.tiers.map((t, i) => ({
          item_id: data.itemId,
          label: t.label,
          amount: t.amount,
          unit: t.unit,
          sort_order: i,
        })),
      );
      if (iErr) fail("replaceTiers insert", iErr.message);
    }
    return { ok: true };
  });
