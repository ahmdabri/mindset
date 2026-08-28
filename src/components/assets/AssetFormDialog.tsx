import { useEffect, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ImagePlus, Star, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { generateUUID } from "@/lib/utils";
import {
  generateAssetCode,
  useCategories,
  useLocations,
  useAssetPhotos,
  type AssetDetail,
  type AssetPhotoRow,
} from "@/hooks/useAssets";
import { Skeleton } from "@/components/ui/skeleton";
import { CONDITION_OPTIONS, OWNERSHIP_OPTIONS, STATUS_OPTIONS } from "@/lib/asset-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  asset_code: z.string().trim().min(3, "Kode aset wajib diisi").max(50),
  asset_name: z.string().trim().min(3, "Nama aset minimal 3 karakter").max(150),
  category_id: z.string().min(1, "Kategori wajib dipilih"),
  location_id: z.string().min(1, "Lokasi wajib dipilih"),
  serial_number: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  specification: z.string().trim().max(2000).optional(),
  acquisition_date: z.string().min(1, "Tanggal perolehan wajib diisi"),
  acquisition_price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  useful_life_years: z.coerce.number().int().min(0).max(100),
  residual_value: z.coerce.number().min(0),
  condition_status: z.string().min(1),
  asset_status: z.string().min(1),
  ownership_status: z.string().min(1),
  description: z.string().trim().max(2000).optional(),
});

type FormState = Record<string, string>;

const EMPTY: FormState = {
  asset_code: "",
  asset_name: "",
  category_id: "",
  location_id: "",
  serial_number: "",
  brand: "",
  model: "",
  specification: "",
  acquisition_date: new Date().toISOString().slice(0, 10),
  acquisition_price: "0",
  useful_life_years: "5",
  residual_value: "0",
  condition_status: "baik",
  asset_status: "tersedia",
  ownership_status: "milik_sendiri",
  description: "",
};

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: AssetDetail | null;
  onSaved?: (id: string) => void;
}) {
  const isEdit = Boolean(asset);
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // Photo Management State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<{ file: File; preview: string }[]>([]);
  const { data: existingPhotos = [], isPending: photosPending } = useAssetPhotos(asset?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStagedFiles([]);
    if (asset) {
      setForm({
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        category_id: String(asset.category_id),
        location_id: String(asset.location_id),
        serial_number: asset.serial_number ?? "",
        brand: asset.brand ?? "",
        model: asset.model ?? "",
        specification: asset.specification ?? "",
        acquisition_date: asset.acquisition_date,
        acquisition_price: String(asset.acquisition_price),
        useful_life_years: String(asset.useful_life_years ?? 0),
        residual_value: String(asset.residual_value),
        condition_status: asset.condition_status,
        asset_status: asset.asset_status,
        ownership_status: asset.ownership_status,
        description: asset.description ?? "",
      });
    } else {
      generateAssetCode()
        .then((code) => setForm({ ...EMPTY, asset_code: code }))
        .catch(() => setForm(EMPTY));
    }
  }, [open, asset]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;

    if (isEdit && asset) {
      setUploading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const existingCount = existingPhotos.length;
        let index = 0;

        for (const file of Array.from(files)) {
          if (!allowed.includes(file.type)) {
            toast.error(`${file.name}: format harus JPG, PNG, atau WEBP`);
            continue;
          }
          if (file.size > maxSize) {
            toast.error(`${file.name}: ukuran maksimal 5 MB`);
            continue;
          }
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const path = `${asset.id}/${generateUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("asset-photos")
            .upload(path, file, { contentType: file.type });
          if (uploadError) throw uploadError;

          const { error: insertError } = await supabase.from("asset_photos").insert({
            asset_id: asset.id,
            file_path: path,
            file_name: file.name,
            is_primary: existingCount === 0 && index === 0,
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
            recordId: asset.id,
            description: `Mengunggah ${index} foto untuk aset ${asset.asset_code}`,
          });
          toast.success(`${index} foto berhasil diunggah`);
          queryClient.invalidateQueries({ queryKey: ["asset-photos", asset.id] });
          queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } else {
      const newStaged: { file: File; preview: string }[] = [];
      for (const file of Array.from(files)) {
        if (!allowed.includes(file.type)) {
          toast.error(`${file.name}: format harus JPG, PNG, atau WEBP`);
          continue;
        }
        if (file.size > maxSize) {
          toast.error(`${file.name}: ukuran maksimal 5 MB`);
          continue;
        }
        newStaged.push({ file, preview: URL.createObjectURL(file) });
      }
      setStagedFiles((prev) => [...prev, ...newStaged]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setPrimary = async (photo: AssetPhotoRow) => {
    if (!asset) return;
    try {
      await supabase.from("asset_photos").update({ is_primary: false }).eq("asset_id", asset.id);
      const { error } = await supabase
        .from("asset_photos")
        .update({ is_primary: true })
        .eq("id", photo.id);
      if (error) throw error;
      toast.success("Foto utama diperbarui");
      queryClient.invalidateQueries({ queryKey: ["asset-photos", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
    } catch {
      toast.error("Gagal mengubah foto utama");
    }
  };

  const deletePhoto = async (photo: AssetPhotoRow) => {
    if (!asset) return;
    try {
      const { error } = await supabase.from("asset_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("asset-photos").remove([photo.file_path]);
      await logActivity({
        action: "DELETE",
        module: "assets",
        tableName: "asset_photos",
        recordId: asset.id,
        description: `Menghapus foto aset ${asset.asset_code}`,
      });
      toast.success("Foto dihapus");
      queryClient.invalidateQueries({ queryKey: ["asset-photos", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
    } catch {
      toast.error("Gagal menghapus foto");
    }
  };

  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Data tidak valid");
      const v = parsed.data;

      const payload = {
        asset_code: v.asset_code,
        asset_name: v.asset_name,
        category_id: Number(v.category_id),
        location_id: Number(v.location_id),
        serial_number: v.serial_number || null,
        brand: v.brand || null,
        model: v.model || null,
        specification: v.specification || null,
        acquisition_date: v.acquisition_date,
        acquisition_price: v.acquisition_price,
        useful_life_years: v.useful_life_years || null,
        residual_value: v.residual_value,
        condition_status: v.condition_status,
        asset_status: v.asset_status,
        ownership_status: v.ownership_status,
        description: v.description || null,
      };

      if (isEdit && asset) {
        const { error: err } = await supabase.from("assets").update(payload).eq("id", asset.id);
        if (err) throw err;
        await logActivity({
          action: "UPDATE",
          module: "assets",
          tableName: "assets",
          recordId: asset.id,
          description: `Memperbarui aset ${payload.asset_code} - ${payload.asset_name}`,
          oldData: asset,
          newData: payload,
        });
        return asset.id;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { data, error: err } = await supabase
        .from("assets")
        .insert({ ...payload, created_by: auth.user?.id ?? null })
        .select("id")
        .single();
      if (err) throw err;

      // QR token langsung dibuat agar aset siap dicetak labelnya.
      await supabase.from("asset_qr_codes").insert({
        asset_id: data.id,
        qr_token: generateUUID().replace(/-/g, ""),
      });

      // Upload any staged files for new asset
      if (stagedFiles.length > 0) {
        let index = 0;
        for (const item of stagedFiles) {
          const ext = item.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const path = `${data.id}/${generateUUID()}.${ext}`;
          await supabase.storage
            .from("asset-photos")
            .upload(path, item.file, { contentType: item.file.type });

          await supabase.from("asset_photos").insert({
            asset_id: data.id,
            file_path: path,
            file_name: item.file.name,
            is_primary: index === 0,
            uploaded_by: auth.user?.id ?? null,
          });
          index += 1;
        }
      }

      await logActivity({
        action: "CREATE",
        module: "assets",
        tableName: "assets",
        recordId: data.id,
        description: `Menambahkan aset ${payload.asset_code} - ${payload.asset_name}`,
        newData: payload,
      });
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      toast.success(isEdit ? "Aset berhasil diperbarui" : "Aset berhasil ditambahkan");
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message.includes("duplicate")
            ? "Kode aset sudah digunakan. Gunakan kode lain."
            : err.message
          : "Gagal menyimpan aset";
      setError(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
          <DialogDescription>Lengkapi data aset. Kolom bertanda * wajib diisi.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode Aset *">
              <Input
                value={form["asset_code"] ?? ""}
                onChange={(e) => set("asset_code")(e.target.value)}
                maxLength={50}
              />
            </Field>
            <Field label="Nama Aset *">
              <Input
                value={form["asset_name"] ?? ""}
                onChange={(e) => set("asset_name")(e.target.value)}
                maxLength={150}
                placeholder="Contoh: Laptop Operasional"
              />
            </Field>

            <Field label="Kategori *">
              <Select value={form["category_id"] ?? ""} onValueChange={set("category_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lokasi *">
              <Select value={form["location_id"] ?? ""} onValueChange={set("location_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                      {l.room ? ` - ${l.room}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Merk">
              <Input value={form["brand"] ?? ""} onChange={(e) => set("brand")(e.target.value)} />
            </Field>
            <Field label="Model / Tipe">
              <Input value={form["model"] ?? ""} onChange={(e) => set("model")(e.target.value)} />
            </Field>
            <Field label="Nomor Seri">
              <Input
                value={form["serial_number"] ?? ""}
                onChange={(e) => set("serial_number")(e.target.value)}
              />
            </Field>
            <Field label="Status Kepemilikan">
              <Select
                value={form["ownership_status"] ?? ""}
                onValueChange={set("ownership_status")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tanggal Perolehan *">
              <Input
                type="date"
                value={form["acquisition_date"] ?? ""}
                onChange={(e) => set("acquisition_date")(e.target.value)}
              />
            </Field>
            <Field label="Harga Perolehan (Rp) *">
              <Input
                type="number"
                min={0}
                value={form["acquisition_price"] ?? ""}
                onChange={(e) => set("acquisition_price")(e.target.value)}
              />
            </Field>
            <Field label="Umur Ekonomis (tahun)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form["useful_life_years"] ?? ""}
                onChange={(e) => set("useful_life_years")(e.target.value)}
              />
            </Field>
            <Field label="Nilai Residu (Rp)">
              <Input
                type="number"
                min={0}
                value={form["residual_value"] ?? ""}
                onChange={(e) => set("residual_value")(e.target.value)}
              />
            </Field>

            <Field label="Kondisi *">
              <Select
                value={form["condition_status"] ?? ""}
                onValueChange={set("condition_status")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status Aset *">
              <Select value={form["asset_status"] ?? ""} onValueChange={set("asset_status")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* FOTO ASET (Ditempatkan di atas Spesifikasi) */}
          <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-xs font-semibold text-foreground">Foto Aset</Label>
                <p className="text-[11px] text-muted-foreground">
                  Format JPG, PNG, atau WEBP (maks. 5 MB). Rasio tampilan 4:3.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Tambah Foto
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Existing photos in edit mode */}
            {isEdit && asset ? (
              photosPending ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
                  ))}
                </div>
              ) : existingPhotos.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-[4/3] max-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-3 text-center transition-colors hover:border-primary/60 hover:bg-card"
                >
                  <ImagePlus className="size-5 text-muted-foreground mb-1" />
                  <p className="text-xs font-medium text-foreground">
                    Pilih atau unggah foto di sini
                  </p>
                  <p className="text-[10px] text-muted-foreground">Maksimal 5 MB per berkas</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  {existingPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-card shadow-xs"
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={photo.file_name ?? "Foto aset"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-muted text-[10px] text-muted-foreground">
                          Tidak ada gambar
                        </div>
                      )}

                      {photo.is_primary ? (
                        <span className="absolute left-1.5 top-1.5 rounded bg-primary/95 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-xs">
                          Utama
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimary(photo)}
                          className="absolute left-1.5 top-1.5 hidden group-hover:flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-white hover:bg-black/90 shadow-xs"
                          title="Jadikan Foto Utama"
                        >
                          <Star className="size-2.5" /> Utama
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deletePhoto(photo)}
                        className="absolute right-1.5 top-1.5 hidden group-hover:flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs"
                        title="Hapus Foto"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : /* Staged photos for new asset creation */
            stagedFiles.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/3] max-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-3 text-center transition-colors hover:border-primary/60 hover:bg-card"
              >
                <ImagePlus className="size-5 text-muted-foreground mb-1" />
                <p className="text-xs font-medium text-foreground">Pilih foto aset</p>
                <p className="text-[10px] text-muted-foreground">
                  Foto akan disimpan bersamaan dengan data aset
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {stagedFiles.map((staged, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-card shadow-xs"
                  >
                    <img
                      src={staged.preview}
                      alt={`Preview ${idx}`}
                      className="h-full w-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-primary/95 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-xs">
                        Utama
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute right-1.5 top-1.5 hidden group-hover:flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs"
                      title="Hapus Foto"
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Spesifikasi">
            <Textarea
              rows={3}
              value={form["specification"] ?? ""}
              onChange={(e) => set("specification")(e.target.value)}
              placeholder="Contoh: Core i7, RAM 16GB, SSD 512GB"
            />
          </Field>
          <Field label="Keterangan">
            <Textarea
              rows={2}
              value={form["description"] ?? ""}
              onChange={(e) => set("description")(e.target.value)}
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Simpan Perubahan" : "Simpan Aset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
