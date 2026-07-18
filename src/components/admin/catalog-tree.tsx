import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { adminCatalogQueryOptions } from "@/lib/queries";
import {
  createCategory,
  updateCategory,
  createSection,
  updateSection,
  createItem,
  deleteEntity,
  setActive,
  reorder,
} from "@/server/admin-catalog";
import type { CatalogCategory, CatalogItem, CatalogSection } from "@/lib/catalog-types";
import { formatTier, isPricedItem } from "@/lib/catalog-types";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SortableList, SortableRow } from "./sortable-list";
import { ItemEditor } from "./item-editor";

/**
 * Wraps a server-fn mutation: on success, invalidates both the admin catalogue
 * cache and the customer-facing catalogue cache (so live edits show up on /menu
 * right away); on error, toasts the message. Exported — Task 17's item editor
 * reuses this for tier/name/photo updates.
 */
export function useAdminAction<TInput, TOutput>(fn: (opts: { data: TInput }) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

function categoryItemCount(cat: CatalogCategory): number {
  return cat.sections.reduce((sum, s) => sum + s.items.length, 0);
}

function computeStats(categories: CatalogCategory[]) {
  let total = 0;
  let live = 0;
  let priced = 0;
  let onRequest = 0;
  for (const cat of categories) {
    for (const sec of cat.sections) {
      for (const it of sec.items) {
        total += 1;
        if (it.active) live += 1;
        if (isPricedItem(it)) priced += 1;
        else onRequest += 1;
      }
    }
  }
  return { total, live, priced, onRequest };
}

function RenameInput({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  };

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onClick={(e) => e.stopPropagation()}
      className={className}
    />
  );
}

function AddInlineForm({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8"
      />
      <Button type="submit" size="sm" variant="outline">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function CatalogTree() {
  const { data: categories } = useSuspenseQuery(adminCatalogQueryOptions());
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  const doCreateCategory = useAdminAction(createCategory);
  const doUpdateCategory = useAdminAction(updateCategory);
  const doCreateSection = useAdminAction(createSection);
  const doUpdateSection = useAdminAction(updateSection);
  const doCreateItem = useAdminAction(createItem);
  const doDelete = useAdminAction(deleteEntity);
  const doSetActive = useAdminAction(setActive);
  const doReorder = useAdminAction(reorder);

  const stats = computeStats(categories);

  const handleDeleteCategory = (cat: CatalogCategory) => {
    const ok = window.confirm(
      `Delete category "${cat.name}" (${cat.sections.length} sections)? Past quotes keep their snapshots.`,
    );
    if (ok) doDelete.mutate({ kind: "category", id: cat.id });
  };
  const handleDeleteSection = (sec: CatalogSection) => {
    const ok = window.confirm(
      `Delete section "${sec.name}" (${sec.items.length} items)? Past quotes keep their snapshots.`,
    );
    if (ok) doDelete.mutate({ kind: "section", id: sec.id });
  };
  const handleDeleteItem = (it: CatalogItem) => {
    const ok = window.confirm(`Delete item "${it.name}"? Past quotes keep their snapshots.`);
    if (ok) doDelete.mutate({ kind: "item", id: it.id });
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center gap-4 rounded-md border p-4 text-sm">
        <div>
          <span className="font-semibold">{stats.total}</span> items total
        </div>
        <div>
          <span className="font-semibold">{stats.live}</span> live
        </div>
        <div>
          <span className="font-semibold">{stats.priced}</span> priced
        </div>
        <div>
          <span className="font-semibold">{stats.onRequest}</span> on request
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-1">
          {categories.map((cat) => (
            <Badge key={cat.id} variant="outline">
              {cat.name}: {categoryItemCount(cat)}
            </Badge>
          ))}
        </div>
      </div>

      <AddInlineForm
        placeholder="New category name"
        onAdd={(name) => doCreateCategory.mutate({ name })}
      />

      <Accordion type="multiple">
        <SortableList
          ids={categories.map((c) => c.id)}
          onReorder={(ids) => doReorder.mutate({ kind: "category", ids })}
        >
          {categories.map((cat) => (
            <AccordionItem
              key={cat.id}
              value={cat.id}
              className={cn("mb-2 rounded-md border px-2", !cat.active && "opacity-50")}
            >
              <SortableRow id={cat.id}>
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="w-8 flex-none justify-center py-2 hover:no-underline" />
                  <RenameInput
                    value={cat.name}
                    onSave={(name) => doUpdateCategory.mutate({ id: cat.id, name })}
                    className="flex-1 font-medium"
                  />
                  <Badge variant="secondary">{categoryItemCount(cat)} items</Badge>
                  <Switch
                    checked={cat.active}
                    onCheckedChange={(active) =>
                      doSetActive.mutate({ kind: "category", id: cat.id, active })
                    }
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </SortableRow>
              <AccordionContent>
                <div className="space-y-3 pl-8">
                  <AddInlineForm
                    placeholder="New section name"
                    onAdd={(name) => doCreateSection.mutate({ categoryId: cat.id, name })}
                  />
                  <Accordion type="multiple">
                    <SortableList
                      ids={cat.sections.map((s) => s.id)}
                      onReorder={(ids) => doReorder.mutate({ kind: "section", ids })}
                    >
                      {cat.sections.map((sec) => (
                        <AccordionItem
                          key={sec.id}
                          value={sec.id}
                          className={cn("mb-2 rounded-md border px-2", !sec.active && "opacity-50")}
                        >
                          <SortableRow id={sec.id}>
                            <div className="flex items-center gap-2">
                              <AccordionTrigger className="w-8 flex-none justify-center py-2 hover:no-underline" />
                              <RenameInput
                                value={sec.name}
                                onSave={(name) => doUpdateSection.mutate({ id: sec.id, name })}
                                className="flex-1"
                              />
                              <Badge variant="secondary">{sec.items.length} items</Badge>
                              <Switch
                                checked={sec.active}
                                onCheckedChange={(active) =>
                                  doSetActive.mutate({ kind: "section", id: sec.id, active })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSection(sec)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </SortableRow>
                          <AccordionContent>
                            <div className="space-y-3 pl-8">
                              <AddInlineForm
                                placeholder="New item name"
                                onAdd={(name) => doCreateItem.mutate({ sectionId: sec.id, name })}
                              />
                              <SortableList
                                ids={sec.items.map((i) => i.id)}
                                onReorder={(ids) => doReorder.mutate({ kind: "item", ids })}
                              >
                                {sec.items.map((it) => (
                                  <SortableRow key={it.id} id={it.id}>
                                    <div
                                      className={cn(
                                        "flex items-center gap-2 py-1",
                                        !it.active && "opacity-50",
                                      )}
                                    >
                                      <span className="flex-1 truncate text-sm">{it.name}</span>
                                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                                        {it.tiers[0] ? formatTier(it.tiers[0]) : "Price on request"}
                                      </span>
                                      <Switch
                                        checked={it.active}
                                        onCheckedChange={(active) =>
                                          doSetActive.mutate({
                                            kind: "item",
                                            id: it.id,
                                            active,
                                          })
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditing(it)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteItem(it)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </SortableRow>
                                ))}
                              </SortableList>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </SortableList>
                  </Accordion>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </SortableList>
      </Accordion>

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
