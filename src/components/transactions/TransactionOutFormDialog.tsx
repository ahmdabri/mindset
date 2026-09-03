import { useCallback, useEffect, useState } from "react";
import { Loader2, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { generateAssetCode, generateTransactionOutCode } from "@/hooks/useAssets";
import { generateUUID } from "@/lib/utils";
import { useLocations } from "@/hooks/useAssets";
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
  transaction_no: z.string().trim().min(3, "No. Transaksi minimal 3 karakter").max(50),
  transaction_date: z.string().min(1, "Tanggal transaksi wajib diisi"),
  asset_id: z.string().min(1, "Barang / Aset wajib dipilih"),
  quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
  destination: z.string().trim().min(3, "Tujuan / Lokasi / Peminjam wajib diisi").max(200),
    location_id: z.string().optional(),
  work_type_id: z.string().optional(),
  item_status: z.enum(["dipinjam", "dipindah", "draft"]),
  notes: z.string().trim().max(1000).optional(),
});

interface FormState {
  transaction_no: string;
  transaction_date: string;
  asset_id: string;
  quantity: string;
  destination: string;
    location_id: string;
  work_type_id: string;
  item_status: "dipinjam" | "dipindah" | "draft";
  notes: string;
}

interface FormErrors {
  transaction_no?: string;
  transaction_date?: string;
  asset_id?: string;
  quantity?: string;
  destination?: string;
  work_type_id?: string;
  notes?: string;
}

const EMPTY: FormState = {
  transaction_no: "",
  transaction_date: new Date().toISOString().split("T")[0] || "",
  asset_id: "",
  quantity: "1",
  destination: "",
  work_type_id: "",
  item_status: "dipindah",
  notes: "",
};

export interface TransactionOutData {
  id?: string;
  transaction_no?: string;
  transaction_date?: string;
  asset_id?: string | null;
  item_name?: string | null;
  quantity?: number | null;
  destination?: string | null;
  work_type_id?: number | string | null;
  notes?: string | null;
    location_id?: string | number | null;
  status?: string;
}

export interface TransactionOutFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TransactionOutData | undefined;
  onSuccess: () => void;
}

interface WorkTypeItem {
  id: string | number;
  name: string;
}

interface AssetItem {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_status: string;
  quantity?: number;
  categories: { name: string } | null;
  location_id: number;
}

interface AssetRecord extends AssetItem {
  category_id: number;
  created_by: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  specification: string | null;
  acquisition_date: string;
  acquisition_price: number;
  useful_life_years: number | null;
  residual_value: number;
  condition_status: string;
  ownership_status: string;
  description: string | null;
}

export function TransactionOutFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: TransactionOutFormDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [workTypes, setWorkTypes] = useState<WorkTypeItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const { data: locations = [] } = useLocations();

  const fetchReferences = useCallback(async () => {
    try {
      const [workTypesRes, assetsRes] = await Promise.all([
        supabase.from("work_types").select("id, name").order("name"),
        supabase
          .from("assets")
          .select("id, asset_code, asset_name, asset_status, quantity, location_id, categories(name)")
          .is("deleted_at", null)
          .order("asset_name"),
      ]);
      if (workTypesRes.data) setWorkTypes(workTypesRes.data as unknown as WorkTypeItem[]);
      if (assetsRes.data) {
        const fetchedAssets = assetsRes.data as unknown as AssetItem[];
        setAssets(fetchedAssets);
        if (initialData?.asset_id) {
          const matched = fetchedAssets.find((a) => a.id === initialData.asset_id);
          if (matched) {
            setSelectedAsset(matched);
            if (!initialData.location_id) {
              setFormData((previous) => ({ ...previous, location_id: String(matched.location_id) }));
            }
          }
        }
      }
    } catch (err) {
      console.error("Gagal mengambil referensi:", err);
    }
  }, [initialData?.asset_id]);

  useEffect(() => {
    if (open) {
      void fetchReferences();
      if (initialData) {
        setFormData({
          transaction_no: initialData.transaction_no || "",
          transaction_date: initialData.transaction_date
            ? initialData.transaction_date.split("T")[0] || ""
            : "",
          asset_id: initialData.asset_id || "",
          quantity: initialData.quantity ? String(initialData.quantity) : "1",
          destination: initialData.destination || "",
          location_id: initialData.location_id ? String(initialData.location_id) : "",
          work_type_id: initialData.work_type_id ? String(initialData.work_type_id) : "",
          item_status:
            initialData.status === "dipinjam" ||
            initialData.status === "dipindah" ||
            initialData.status === "draft"
              ? initialData.status
              : "dipindah",
          notes: initialData.notes || "",
        });
      } else {
        // Auto-generate sequential TRX-OUT code
        generateTransactionOutCode()
          .then((autoNo) => {
            setFormData({ ...EMPTY, transaction_no: autoNo });
          })
          .catch(() => {
            const year = new Date().getFullYear();
            setFormData({ ...EMPTY, transaction_no: `TRX-OUT-${year}-001` });
          });
      }
      setErrors({});
    }
  }, [open, initialData, fetchReferences]);

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAssetChange = (assetId: string) => {
    handleChange("asset_id", assetId);
    const asset = assets.find((a) => a.id === assetId) ?? null;
    setSelectedAsset(asset);
    if (asset) handleChange("location_id", String(asset.location_id));
  };

  const isOtherLocation = formData.location_id === "other";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = schema.parse(formData);

      if (parsed.item_status === "dipindah" && !parsed.location_id) {
        setErrors((prev) => ({ ...prev, location_id: "Lokasi tujuan wajib dipilih" }));
        return;
      }

      // Validate stock availability
      const targetAsset = selectedAsset || assets.find((a) => a.id === parsed.asset_id);
      const currentStock = targetAsset?.quantity ?? 1;

      if (!initialData?.id && parsed.quantity > currentStock) {
        setErrors((prev) => ({
          ...prev,
          quantity: `Jumlah keluar (${parsed.quantity}) melebihi stok yang tersedia (${currentStock} unit)`,
        }));
        toast.error(`Stok tidak mencukupi. Tersedia: ${currentStock} unit.`);
        return;
      }

      setLoading(true);
      const finalStatus = parsed.item_status;
      const payload = {
        type: "OUT",
        transaction_no: parsed.transaction_no,
        transaction_date: parsed.transaction_date,
        destination: parsed.destination,
        work_type_id: parsed.work_type_id ? String(parsed.work_type_id) : null,
        notes: parsed.notes || null,
        status: finalStatus,
        asset_id: parsed.asset_id,
        item_name: targetAsset?.asset_name || null,
        quantity: parsed.quantity,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("inventory_transactions")
          .update(payload)
          .eq("id", initialData.id);
        if (error) {
          if (error.code === "23505") throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }
        if (finalStatus === "dipindah" && parsed.location_id && parsed.location_id !== "other") {
          const { error: locationError } = await supabase
            .from("assets")
            .update({ location_id: Number(parsed.location_id) })
            .eq("id", parsed.asset_id)
            .select("id, location_id")
            .single();
          if (locationError) throw locationError;
        }
        await logActivity({
          action: "UPDATE",
          module: "transactions-out",
          tableName: "inventory_transactions",
          recordId: initialData.id,
          description: `Memperbarui transaksi keluar: ${parsed.transaction_no} (${finalStatus})`,
        });
        toast.success("Transaksi berhasil diperbarui");
      } else {
        const { data: newTrx, error } = await supabase
          .from("inventory_transactions")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          if (error.code === "23505") throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }

        let newStock = Math.max(0, currentStock - parsed.quantity);
        let assetUpdateErr: { message: string } | null = null;

        if (finalStatus === "dipindah" && parsed.location_id && parsed.location_id !== "other") {
          const { data: sourceAsset, error: sourceError } = await supabase
            .from("assets")
            .select("*")
            .eq("id", parsed.asset_id)
            .single();
          if (sourceError) throw sourceError;

          if (parsed.quantity < currentStock) {
            const { error: sourceUpdateError } = await supabase
              .from("assets")
              .update({ quantity: currentStock - parsed.quantity, asset_status: "tersedia" })
              .eq("id", parsed.asset_id);
            if (sourceUpdateError) throw sourceUpdateError;

            const movedAsset = {
              category_id: sourceAsset.category_id,
              location_id: Number(parsed.location_id),
              created_by: sourceAsset.created_by,
              asset_code: await generateAssetCode(),
              asset_name: sourceAsset.asset_name,
              serial_number: null,
              brand: sourceAsset.brand,
              model: sourceAsset.model,
              specification: sourceAsset.specification,
              acquisition_date: sourceAsset.acquisition_date,
              acquisition_price: sourceAsset.acquisition_price,
              useful_life_years: sourceAsset.useful_life_years,
              residual_value: sourceAsset.residual_value,
              condition_status: sourceAsset.condition_status,
              asset_status: "tersedia",
              ownership_status: sourceAsset.ownership_status,
              quantity: parsed.quantity,
              description: `Hasil pemindahan ${parsed.quantity} unit dari aset ${sourceAsset.asset_code}`,
            };
            const { data: movedAssetRow, error: movedAssetError } = await supabase
              .from("assets")
              .insert(movedAsset)
              .select("id")
              .single();
            if (movedAssetError) throw movedAssetError;

            const { error: transactionAssetError } = await supabase
              .from("inventory_transactions")
              .update({ asset_id: movedAssetRow.id })
              .eq("id", newTrx.id);
            if (transactionAssetError) throw transactionAssetError;
            const { error: qrError } = await supabase.from("asset_qr_codes").insert({
              asset_id: movedAssetRow.id,
              qr_token: generateUUID().replace(/-/g, ""),
            });
            if (qrError) throw qrError;
            newStock = currentStock - parsed.quantity;
          } else {
            const { error: moveAllError } = await supabase
              .from("assets")
              .update({ location_id: Number(parsed.location_id) })
              .eq("id", parsed.asset_id);
            if (moveAllError) throw moveAllError;
            newStock = currentStock;
          }
        } else {
          const { error } = await supabase
            .from("assets")
            .update({
              quantity: newStock,
              asset_status: newStock === 0 ? "habis" : "tersedia",
            })
            .eq("id", parsed.asset_id)
            .select("id, quantity, location_id")
            .single();
          assetUpdateErr = error;
        }

        if (assetUpdateErr) {
          console.error("Gagal memperbarui stok aset:", assetUpdateErr);
          toast.warning("Transaksi tercatat, namun terjadi kendala saat memperbarui stok aset.");
        } else {
          toast.success(
            `Transaksi keluar dicatat. ${targetAsset?.asset_name} tersisa ${newStock} unit dan lokasi aset telah diperbarui.`,
          );
        }

        await logActivity({
          action: "CREATE",
          module: "transactions-out",
          tableName: "inventory_transactions",
          recordId: newTrx?.id,
          description: `Mencatat barang keluar: ${parsed.transaction_no} (${targetAsset?.asset_name} ${parsed.quantity} unit, sisa stok ${newStock})`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "active"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        err.errors.forEach((e) => {
          const field = e.path[0];
          if (typeof field === "string" && field in EMPTY) {
            fieldErrors[field as keyof FormErrors] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error("Error saving transaction:", err);
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan transaksi";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const availableAssets = assets.filter((a) => a.asset_status === "tersedia");
  const otherAssets = assets.filter((a) => a.asset_status !== "tersedia");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="size-5 text-orange-500" />
            {initialData ? "Edit Barang Keluar" : "Catat Barang Keluar"}
          </DialogTitle>
          <DialogDescription>
            Pencatatan pengeluaran barang: mutasi (dipindah) dan peminjaman (dipinjam).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Pilih Barang */}
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900 p-4 space-y-3">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
              Barang yang Dikeluarkan
            </p>
            <div className="space-y-2">
              <Label htmlFor="asset_id">
                Pilih Barang / Aset <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.asset_id || ""} onValueChange={handleAssetChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Cari dan pilih barang..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40">
                        Tersedia ({availableAssets.length} unit)
                      </div>
                      {availableAssets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          <span className="font-semibold">{asset.asset_code}</span>
                          {" — "}
                          <span>{asset.asset_name}</span>
                          <span className="ml-1.5 text-xs text-primary font-medium">
                            (Stok: {asset.quantity ?? 1})
                          </span>
                          {asset.categories?.name && (
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              • {asset.categories.name}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {otherAssets.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/60">
                        Lainnya ({otherAssets.length} unit)
                      </div>
                      {otherAssets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          <span className="font-medium text-muted-foreground">
                            {asset.asset_code}
                          </span>
                          {" — "}
                          <span className="text-muted-foreground">{asset.asset_name}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            (Stok: {asset.quantity ?? 0} • {asset.asset_status})
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {errors.asset_id && <p className="text-xs text-destructive">{errors.asset_id}</p>}
              {selectedAsset && (
                <div className="rounded-lg bg-background border border-border p-2.5 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary font-bold">
                      {selectedAsset.asset_code}
                    </span>
                    <span className="font-semibold">{selectedAsset.asset_name}</span>
                    {selectedAsset.categories?.name && (
                      <span className="text-xs text-muted-foreground">
                        • {selectedAsset.categories.name}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Stok Tersedia: {selectedAsset.quantity ?? 1} unit
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${selectedAsset.asset_status === "tersedia" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {selectedAsset.asset_status}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">
                Jumlah Dikeluarkan <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={selectedAsset?.quantity ?? undefined}
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                  className="w-36"
                />
                {selectedAsset && (
                  <span className="text-xs text-muted-foreground">
                    Sisa stok setelah keluar:{" "}
                    <strong className="text-foreground">
                      {Math.max(0, (selectedAsset.quantity ?? 1) - (Number(formData.quantity) || 0))} unit
                    </strong>
                  </span>
                )}
              </div>
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <Label className="text-sm font-semibold">
              Status / Jenis Pengeluaran <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.item_status}
              onValueChange={(val: "dipinjam" | "dipindah" | "draft") =>
                handleChange("item_status", val)
              }
            >
              <SelectTrigger className="bg-background font-medium">
                <SelectValue placeholder="Pilih status barang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dipindah">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    Di Pindah (Mutasi Lokasi/Ruangan)
                  </span>
                </SelectItem>
                <SelectItem value="dipinjam">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    Di Pinjam (Peminjaman Aset/Unit)
                  </span>
                </SelectItem>
                <SelectItem value="draft">
                  <span className="text-muted-foreground">Draft</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {formData.item_status === "dipinjam" &&
                "Barang berstatus 'Di Pinjam' sementara oleh pihak peminjam."}
              {formData.item_status === "dipindah" &&
                "Barang berstatus 'Di Pindah' untuk mutasi tempat atau ruangan."}
            </p>
          </div>

          {/* Info Transaksi */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Informasi Transaksi
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="transaction_no">
                  No. Transaksi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transaction_no"
                  placeholder="Misal: TRX-OUT-2026-001"
                  value={formData.transaction_no}
                  onChange={(e) => handleChange("transaction_no", e.target.value.toUpperCase())}
                />
                {errors.transaction_no ? (
                  <p className="text-xs text-destructive">{errors.transaction_no}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transaction_date">
                  Tanggal Keluar <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => handleChange("transaction_date", e.target.value)}
                />
                {errors.transaction_date ? (
                  <p className="text-xs text-destructive">{errors.transaction_date}</p>
                ) : null}
              </div>
            </div>
            {formData.item_status === "dipindah" && (
              <div className="space-y-1.5">
                <Label htmlFor="location_id">
                  Lokasi Tujuan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.location_id || ""}
                  onValueChange={(value) => {
                    handleChange("location_id", value);
                    const location = locations.find((item) => String(item.id) === value);
                    if (location) {
                      handleChange(
                        "destination",
                        `${location.name}${location.room ? ` - ${location.room}` : ""}`,
                      );
                    } else if (value === "other") {
                      handleChange("destination", "");
                    }
                  }}
                >
                  <SelectTrigger id="location_id">
                    <SelectValue placeholder="Pilih lokasi terdaftar" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={String(location.id)}>
                        {location.name}
                        {location.room ? ` - ${location.room}` : ""}
                        {location.building ? ` (${location.building})` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
                {isOtherLocation && (
                  <Input
                    id="destination"
                    placeholder="Ketik lokasi atau ruangan tujuan"
                    value={formData.destination}
                    onChange={(e) => handleChange("destination", e.target.value)}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Lokasi master akan memperbarui lokasi aset. Pilih Lainnya untuk lokasi yang belum terdaftar.
                </p>
                {errors.location_id ? (
                  <p className="text-xs text-destructive">{errors.location_id}</p>
                ) : null}
                {errors.destination ? (
                  <p className="text-xs text-destructive">{errors.destination}</p>
                ) : null}
              </div>
            )}
            {formData.item_status === "dipinjam" && (
              <div className="space-y-1.5">
                <Label htmlFor="destination">
                  Nama Peminjam / Unit Peminjam <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="destination"
                  placeholder="Misal: Ahmad Dani (Bidang Informatika)"
                  value={formData.destination}
                  onChange={(e) => handleChange("destination", e.target.value)}
                />
                {errors.destination ? (
                  <p className="text-xs text-destructive">{errors.destination}</p>
                ) : null}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="work_type_id">Jenis Pekerjaan (Opsional)</Label>
              <Select
                value={formData.work_type_id || "none"}
                onValueChange={(val) => handleChange("work_type_id", val === "none" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis pekerjaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tidak ada --</SelectItem>
                  {workTypes.map((wt) => (
                    <SelectItem key={wt.id} value={String(wt.id)}>
                      {wt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan & Penjelasan</Label>
              <Textarea
                id="notes"
                placeholder="Jelaskan keperluan peminjaman / alasan perpindahan / keterangan kerusakan..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
              {errors.notes ? <p className="text-xs text-destructive">{errors.notes}</p> : null}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan Barang Keluar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
