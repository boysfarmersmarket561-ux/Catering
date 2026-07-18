export interface QuoteItemRow {
  id: string;
  name: string;
  active: boolean;
  section: { name: string; active: boolean; category: { name: string; active: boolean } };
  price_tiers: Array<{
    id: string;
    label: string | null;
    amount: string | number | null;
    unit: string;
  }>;
}

export interface RequestedLine {
  itemId: string;
  tierId: string | null;
  quantity: number;
}

export interface ResolvedLine {
  itemId: string;
  itemName: string;
  categoryName: string;
  sectionName: string;
  tierLabel: string | null;
  unit: string | null;
  unitAmount: number | null;
  quantity: number;
}

export function resolveQuoteLines(
  items: QuoteItemRow[],
  requested: RequestedLine[],
): { lines: ResolvedLine[]; subtotal: number; hasUnpriced: boolean } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: ResolvedLine[] = [];
  for (const req of requested) {
    const item = byId.get(req.itemId);
    if (!item || !item.active || !item.section.active || !item.section.category.active) continue;
    let tierLabel: string | null = null,
      unit: string | null = null,
      unitAmount: number | null = null;
    if (req.tierId != null) {
      const tier = item.price_tiers.find((t) => t.id === req.tierId);
      if (!tier) continue;
      tierLabel = tier.label;
      unit = tier.unit;
      unitAmount = tier.amount == null ? null : Number(tier.amount);
    }
    lines.push({
      itemId: item.id,
      itemName: item.name,
      categoryName: item.section.category.name,
      sectionName: item.section.name,
      tierLabel,
      unit,
      unitAmount,
      quantity: req.quantity,
    });
  }
  const subtotal = lines.reduce((s, l) => s + (l.unitAmount ?? 0) * l.quantity, 0);
  const hasUnpriced = lines.some((l) => l.unitAmount == null);
  return { lines, subtotal, hasUnpriced };
}
