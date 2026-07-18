import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/server/catalog";
import { getAdminCatalog } from "@/server/admin-catalog";
import { listQuotes } from "@/server/admin-quotes";
import { listStaff } from "@/server/admin-users";
import { getSettings } from "@/server/settings";

export const catalogQueryOptions = () =>
  queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });

export const adminCatalogQueryOptions = () =>
  queryOptions({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });

export const adminQuotesQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ["admin-quotes", includeArchived],
    queryFn: () => listQuotes({ data: { includeArchived } }),
  });

export const staffQueryOptions = () =>
  queryOptions({ queryKey: ["admin-staff"], queryFn: () => listStaff() });

export const settingsQueryOptions = () =>
  queryOptions({ queryKey: ["settings"], queryFn: () => getSettings(), staleTime: 5 * 60 * 1000 });
