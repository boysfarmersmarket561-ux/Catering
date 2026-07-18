import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { CatalogItem, PriceUnit } from "@/lib/catalog-types";
import { PRICE_UNITS, formatUnit } from "@/lib/catalog-types";
import { updateItemFn, replaceTiers } from "@/server/admin-catalog";
import { useAdminAction } from "@/components/admin/catalog-tree";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TierDraft {
  label: string;
  amount: string;
  unit: PriceUnit;
}

export function ItemEditor({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [size, setSize] = useState(item.size ?? "");
  const [serves, setServes] = useState(item.serves ?? "");
  const [tiers, setTiers] = useState<TierDraft[]>(
    item.tiers.map((t) => ({
      label: t.label ?? "",
      amount: t.amount == null ? "" : String(t.amount),
      unit: t.unit,
    })),
  );

  const doUpdateItem = useAdminAction(updateItemFn);
  const doReplaceTiers = useAdminAction(replaceTiers);
  const saving = doUpdateItem.isPending || doReplaceTiers.isPending;

  const addTier = () => setTiers((prev) => [...prev, { label: "", amount: "", unit: "each" }]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));
  const updateTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const handleSave = async () => {
    for (const t of tiers) {
      const trimmed = t.amount.trim();
      if (trimmed && Number.isNaN(Number(trimmed))) {
        toast.error(`"${t.amount}" isn't a valid price`);
        return;
      }
    }

    try {
      await doUpdateItem.mutateAsync({
        id: item.id,
        name: name.trim() || item.name,
        description: description.trim() || null,
        size: size.trim() || null,
        serves: serves.trim() || null,
      });
      await doReplaceTiers.mutateAsync({
        itemId: item.id,
        tiers: tiers.map((t) => ({
          label: t.label.trim() || null,
          amount: t.amount.trim() === "" ? null : Number(t.amount.trim()),
          unit: t.unit,
        })),
      });
      toast.success("Item saved");
      onClose();
    } catch {
      // useAdminAction already toasts the error
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          <ImageUpload kind="item" id={item.id} imageUrl={item.imageUrl} />

          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-size">Size</Label>
              <Input id="item-size" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-serves">Serves</Label>
              <Input id="item-serves" value={serves} onChange={(e) => setServes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Price tiers</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="mr-1 h-4 w-4" /> Add tier
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave the price blank for "price on request".
            </p>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Label (e.g. Small)"
                    value={t.label}
                    onChange={(e) => updateTier(i, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="Price"
                    value={t.amount}
                    onChange={(e) => updateTier(i, { amount: e.target.value })}
                    className="w-24"
                  />
                  <Select
                    value={t.unit}
                    onValueChange={(unit: PriceUnit) => updateTier(i, { unit })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {formatUnit(u) || u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
