import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { generateUUID } from "@/lib/utils";
import { useAssetPhotos, type AssetPhotoRow } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function AssetPhotoManager({
  assetId,
  assetCode,
  canEdit,
}: {
  assetId: string;
  assetCode: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: photos, isPending } = useAssetPhotos(assetId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<AssetPhotoRow | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["asset-photos", assetId] });
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const existing = photos?.length ?? 0;
      let index = 0;
      for (const file of Array.from(files)) {
        if (!ALLOWED.includes(file.type)) {
          toast.error(`${file.name}: format harus JPG, PNG, atau WEBP`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: ukuran maksimal 5 MB`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${assetId}/${generateUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("asset_photos").insert({
          asset_id: assetId,
          file_path: path,
          file_name: file.name,
          is_primary: existing === 0 && index === 0,
          uploaded_by: auth.user?.id ?? null,
        });
        if (insertError) throw insertError;
        index += 1;
      }
      if (index > 0) {
        await logActivity({
          action: "UPLOAD",
          module: "assets",
          tableName: "asset_photos",
          recordId: assetId,
          description: `Mengunggah ${index} foto untuk aset ${assetCode}`,
        });
        toast.success(`${index} foto berhasil diunggah`);
        refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const setPrimary = useMutation({
    mutationFn: async (photo: AssetPhotoRow) => {
      await supabase.from("asset_photos").update({ is_primary: false }).eq("asset_id", assetId);
      const { error } = await supabase
        .from("asset_photos")
        .update({ is_primary: true })
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto utama diperbarui");
      refresh();
    },
    onError: () => toast.error("Gagal mengubah foto utama"),
  });

  const remove = useMutation({
    mutationFn: async (photo: AssetPhotoRow) => {
      const { error } = await supabase.from("asset_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("asset-photos").remove([photo.file_path]);
      await logActivity({
        action: "DELETE",
        module: "assets",
        tableName: "asset_photos",
        recordId: assetId,
        description: `Menghapus foto aset ${assetCode}`,
      });
    },
    onSuccess: () => {
      toast.success("Foto dihapus");
      setToDelete(null);
      refresh();
    },
    onError: () => toast.error("Gagal menghapus foto"),
  });

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            Unggah Foto
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG, atau WEBP - maksimal 5 MB.</p>
        </div>
      ) : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-4/3 w-full rounded-xl" />
          ))}
        </div>
      ) : (photos?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <ImagePlus className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada foto untuk aset ini.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos?.map((photo) => (
            <figure
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card"
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.file_name ?? `Foto aset ${assetCode}`}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                />
              ) : (
                <div className="grid aspect-4/3 w-full place-items-center bg-muted text-xs text-muted-foreground">
                  Gambar tidak tersedia
                </div>
              )}
              {photo.is_primary ? (
                <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Foto utama
                </span>
              ) : null}
              {canEdit ? (
                <figcaption className="flex items-center justify-between gap-2 border-t border-border p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={photo.is_primary || setPrimary.isPending}
                    onClick={() => setPrimary.mutate(photo)}
                  >
                    <Star className="size-4" /> Jadikan utama
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Hapus foto"
                    onClick={() => setToDelete(photo)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus foto ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Foto akan dihapus permanen dari penyimpanan dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove.mutate(toDelete)}
              disabled={remove.isPending}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
