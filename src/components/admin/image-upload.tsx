import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageOff, Upload, X } from "lucide-react";
import { uploadImage, removeImage } from "@/server/admin-catalog";
import { resizeImage } from "@/lib/image-resize";
import { Button } from "@/components/ui/button";

export function ImageUpload({
  kind,
  id,
  imageUrl,
}: {
  kind: "category" | "item";
  id: string;
  imageUrl: string | null;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(imageUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("id", id);
      fd.set("file", new File([resized], "image.jpg", { type: "image/jpeg" }));
      const result = await uploadImage({ data: fd });
      setPreview(result.imageUrl);
      invalidate();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeImage({ data: { kind, id } });
      setPreview(null);
      invalidate();
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        <img src={preview} alt="" className="h-20 w-28 flex-none rounded-md border object-cover" />
      ) : (
        <div className="flex h-20 w-28 flex-none items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          <ImageOff className="mr-1 h-4 w-4" /> No photo
        </div>
      )}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1 h-4 w-4" /> {preview ? "Replace" : "Upload"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
