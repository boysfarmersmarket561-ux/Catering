import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/server/catalog";

export const catalogQueryOptions = () =>
  queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });
