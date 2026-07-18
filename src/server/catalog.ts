import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin, imageBaseUrl } from "@/lib/supabase.server";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";
import type { CatalogCategory } from "@/lib/catalog-types";

export const CATALOG_SELECT = `id,name,description,image_path,sort_order,active,
sections(id,name,note,sort_order,active,
items(id,name,description,size,serves,image_path,sort_order,active,
price_tiers(id,label,amount,unit,sort_order)))`.replace(/\n/g, "");

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogCategory[]> => {
    const { data, error } = await supabaseAdmin().from("categories").select(CATALOG_SELECT);
    if (error) throw new Error(`getCatalog: ${error.message}`);
    return mapCatalogRows((data ?? []) as unknown as DbCategoryRow[], {
      includeInactive: false,
      imageBase: imageBaseUrl(),
    });
  },
);
