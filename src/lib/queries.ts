import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/server/catalog";
import { getAdminCatalog } from "@/server/admin-catalog";

export const catalogQueryOptions = () =>
  queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });

export const adminCatalogQueryOptions = () =>
  queryOptions({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });
