import { useCallback, useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { logActivity } from "@/lib/activity";
import { generateUUID } from "@/lib/utils";
import { generateAssetCode, generateTransactionInCode } from "@/hooks/useAssets";
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
  item_name: z.string().trim().min(2, "Nama barang wajib diisi").max(150),
  category_id: z.string().min(1, "Kategori barang wajib dipilih"),
  location_id: z.string().min(1, "Lokasi wajib dipilih"),
  quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
  reference_no: z.string().trim().max(100).optional(),
  vendor_id: z.string().min(1, "Penyedia wajib dipilih"),
  work_type_id: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["draft", "processing", "completed", "cancelled"]),
});

type TransactionStatus = "draft" | "processing" | "completed" | "cancelled";

type TransactionFormState = {
  transaction_no: string;
  transaction_date: string;
  item_name: string;
  category_id: string;
  location_id: string;
  quantity: string;
  reference_no: string;
  vendor_id: string;
  work_type_id: string;
  notes: string;
  status: TransactionStatus;
};

type TransactionFormErrors = Partial<Record<keyof TransactionFormState, string>>;

type TransactionInitialData = {
  id?: string;
  transaction_no?: string | null;
  transaction_date?: string | null;
  item_name?: string | null;
  category_id?: string | number | null;
  location_id?: string | number | null;
  quantity?: number | null;
  reference_no?: string | null;
  vendor_id?: string | number | null;
  work_type_id?: string | number | null;
  notes?: string | null;
  status?: TransactionStatus | null;
};

const EMPTY: TransactionFormState = {
  transaction_no: "",
  transaction_date: new Date().toISOString().split("T")[0] ?? "",
  item_name: "",
  category_id: "",
  location_id: "",
  quantity: "1",
  reference_no: "",
  vendor_id: "",
  work_type_id: "",
  notes: "",
  status: "completed",
};

interface TransactionInFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TransactionInitialData | null;
  onSuccess: () => void;
}

export function TransactionInFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: TransactionInFormDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TransactionFormState>(EMPTY);
  const [errors, setErrors] = useState<TransactionFormErrors>({});

  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [workTypes, setWorkTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const { data: locations = [] } = useLocations();

  const fetchReferences = useCallback(async () => {
    try {
      const [vendorsRes, workTypesRes, categoriesRes] = await Promise.all([
        supabase.from("vendors").select("id, name").order("name"),
        supabase.from("work_types").select("id, name").order("name"),
        supabase.from("categories").select("id, name").eq("status", "active").order("name"),
      ]);

      if (vendorsRes.data) setVendors(vendorsRes.data as Array<{ id: string; name: string }>);
      if (workTypesRes.data) setWorkTypes(workTypesRes.data as Array<{ id: string; name: string }>);
      if (categoriesRes.data)
        setCategories(categoriesRes.data as Array<{ id: number; name: string }>);
    } catch (err) {
      console.error("Gagal mengambil referensi:", err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchReferences();

      if (initialData) {
        setFormData({
          transaction_no: initialData.transaction_no || "",
          transaction_date: initialData.transaction_date
            ? (initialData.transaction_date.split("T")[0] ?? "")
            : "",
          item_name: initialData.item_name || "",
          category_id: initialData.category_id ? String(initialData.category_id) : "",
          location_id: initialData.location_id ? String(initialData.location_id) : (locations[0] ? String(locations[0].id) : ""),
          quantity: initialData.quantity ? String(initialData.quantity) : "1",
          reference_no: initialData.reference_no || "",
          vendor_id: initialData.vendor_id ? String(initialData.vendor_id) : "",
          work_type_id: initialData.work_type_id ? String(initialData.work_type_id) : "",
          notes: initialData.notes || "",
          status: initialData.status || "completed",
        });
      } else {
        // Auto-generate transaction number sequentially (TRX-IN-YYYY-001...)
        generateTransactionInCode()
          .then((autoNo) => {
            setFormData({ ...EMPTY, transaction_no: autoNo });
          })
          .catch(() => {
            const year = new Date().getFullYear();
            setFormData({ ...EMPTY, transaction_no: `TRX-IN-${year}-001` });
          });
      }
      setErrors({});
    }
  }, [open, initialData, fetchReferences, locations]);

  const handleChange = <K extends keyof TransactionFormState>(
    field: K,
    value: TransactionFormState[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /** Auto-create 1 data aset dengan stok jumlah (quantity) saat transaksi masuk selesai */
  const autoCreateAssets = async (
    itemName: string,
    categoryId: number,
    quantity: number,
    acquisitionDate: string,
    locationId: number,
  ) => {
    try {
      const insertWithRetry = async (): Promise<{ id: string } | null> => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const assetCode = await generateAssetCode();
          const payload: TablesInsert<"assets"> = {
            asset_code: assetCode,
            asset_name: itemName,
            category_id: categoryId,
            location_id: locationId,
            acquisition_date: acquisitionDate,
            acquisition_price: 0,
            condition_status: "baik",
            asset_status: "tersedia",
            ownership_status: "milik_sendiri",
            residual_value: 0,
            quantity: quantity,
            description: `Barang masuk (${quantity} unit)`,
          };

          const { data: insertedAsset, error } = await supabase
            .from("assets")
            .insert(payload)
            .select("id")
            .single();

          if (!error) {
            return insertedAsset;
          }

          if (error.code === "23505" && /asset_code/i.test(error.message ?? "")) {
            if (attempt < 9) {
              await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
              continue;
            }
          }

          throw error;
        }

        throw new Error("Gagal membuat kode aset unik setelah beberapa percobaan.");
      };

      const insertedAsset = await insertWithRetry();

      if (insertedAsset?.id) {
        await supabase.from("asset_qr_codes").insert({
          asset_id: insertedAsset.id,
          qr_token: generateUUID().replace(/-/g, ""),
        });
      }

      toast.success(`1 Data aset baru (${itemName}) dengan stok ${quantity} unit berhasil dibuat otomatis.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat membuat aset otomatis";
      console.error("Gagal membuat aset otomatis:", err);
      toast.warning(`Transaksi tersimpan, namun gagal membuat aset otomatis: ${message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsed = schema.parse(formData);
      setLoading(true);

      const payload: TablesInsert<"inventory_transactions"> = {
        type: "IN",
        transaction_no: parsed.transaction_no,
        transaction_date: parsed.transaction_date,
        item_name: parsed.item_name,
        category_id: Number(parsed.category_id),
        quantity: parsed.quantity,
        reference_no: parsed.reference_no || null,
        vendor_id: parsed.vendor_id,
        work_type_id: parsed.work_type_id || null,
        notes: parsed.notes || null,
        status: parsed.status,
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("inventory_transactions")
          .update(payload)
          .eq("id", initialData.id);

        if (error) {
          if (error.code === "23505") throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }

        await logActivity({
          action: "UPDATE",
          module: "Barang Masuk",
          tableName: "inventory_transactions",
          recordId: initialData.id,
          description: `Memperbarui transaksi masuk: ${parsed.transaction_no} — ${parsed.item_name} (${parsed.quantity} unit)`,
        });
        toast.success("Transaksi berhasil diperbarui");
      } else {
        // Create
        const { data: newTrx, error } = await supabase
          .from("inventory_transactions")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505") throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }

        await logActivity({
          action: "CREATE",
          module: "Barang Masuk",
          tableName: "inventory_transactions",
          description: `Mencatat transaksi masuk baru: ${parsed.transaction_no} — ${parsed.item_name} (${parsed.quantity} unit)`,
        });

        // Otomatis buat aset jika status completed
        if (parsed.status === "completed" && newTrx?.id) {
          await autoCreateAssets(
            parsed.item_name,
            Number(parsed.category_id),
            parsed.quantity,
            parsed.transaction_date,
            Number(parsed.location_id),
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: TransactionFormErrors = {};
        err.errors.forEach((e) => {
          const key = e.path[0];
          if (typeof key === "string") {
            fieldErrors[key as keyof TransactionFormState] = e.message;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-green-600" />
            {initialData ? "Edit Barang Masuk" : "Catat Barang Masuk"}
          </DialogTitle>
          <DialogDescription>
            Isi detail transaksi penerimaan atau masuknya barang ke inventaris.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* === Informasi Barang === */}
          <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
              Informasi Barang
            </p>

            <div className="space-y-2">
              <Label htmlFor="item_name">
                Nama Barang <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item_name"
                placeholder="Misal: Laptop ASUS VivoBook, Printer Canon, dll."
                value={formData.item_name}
                onChange={(e) => handleChange("item_name", e.target.value)}
              />
              {errors.item_name && <p className="text-xs text-destructive">{errors.item_name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category_id">
                  Kategori / Jenis Barang <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category_id || ""}
                  onValueChange={(val) => handleChange("category_id", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category_id && (
                  <p className="text-xs text-destructive">{errors.category_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Jumlah Barang <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  placeholder="Misal: 5"
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                />
                {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
                {formData.status === "completed" && Number(formData.quantity) > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ 1 data aset ({formData.item_name || "barang"}) akan dibuat otomatis dengan keterangan stok {formData.quantity} unit
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_id">
                Lokasi Penyimpanan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.location_id || ""}
                onValueChange={(val) => handleChange("location_id", val)}
              >
                <SelectTrigger id="location_id">
                  <SelectValue placeholder="Pilih lokasi aset" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.name}
                      {location.room ? ` - ${location.room}` : ""}
                      {location.building ? ` (${location.building})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location_id && <p className="text-xs text-destructive">{errors.location_id}</p>}
            </div>
          </div>

          {/* === Informasi Transaksi === */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Informasi Transaksi
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transaction_no">
                  No. Transaksi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transaction_no"
                  placeholder="Misal: TRX-IN-2026-001"
                  value={formData.transaction_no}
                  onChange={(e) => handleChange("transaction_no", e.target.value.toUpperCase())}
                />
                {errors.transaction_no && (
                  <p className="text-xs text-destructive">{errors.transaction_no}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_date">
                  Tanggal Masuk <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => handleChange("transaction_date", e.target.value)}
                />
                {errors.transaction_date && (
                  <p className="text-xs text-destructive">{errors.transaction_date}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_id">
                  Penyedia <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.vendor_id || ""}
                  onValueChange={(val) => handleChange("vendor_id", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih penyedia" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={String(vendor.id)}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.vendor_id && <p className="text-xs text-destructive">{errors.vendor_id}</p>}
              </div>

              <div className="space-y-2">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_no">No. Referensi / SPK (Opsional)</Label>
              <Input
                id="reference_no"
                placeholder="No. Surat / Dokumen Pengadaan"
                value={formData.reference_no}
                onChange={(e) => handleChange("reference_no", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Tambahan</Label>
              <Textarea
                id="notes"
                placeholder="Keterangan kondisi penerimaan..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => handleChange("status", val as TransactionStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Selesai (Diterima)</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
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
              {loading ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
