import type { CatalogItem } from "@/lib/catalog-types";

/**
 * Placeholder — Task 17 builds the real item editor (name/description/size/serves,
 * price tiers, photo upload). This stub exists only so catalog-tree.tsx compiles and
 * the "open editor" seam is wired up; it renders nothing and closes immediately.
 */
export function ItemEditor({ onClose }: { item: CatalogItem; onClose: () => void }) {
  onClose();
  return null;
}
