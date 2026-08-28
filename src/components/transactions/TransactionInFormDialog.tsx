import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
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
  reference_no: z.string().trim().max(100).optional(),
  vendor_id: z.string().min(1, "Penyedia wajib dipilih"),
  work_type_id: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["draft", "processing", "completed", "cancelled"]),
});

type FormState = Record<string, string>;

const EMPTY: FormState = {
  transaction_no: "",
  transaction_date: new Date().toISOString().split("T")[0],
  reference_no: "",
  vendor_id: "",
  work_type_id: "",
  notes: "",
  status: "completed",
};

interface TransactionInFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  onSuccess: () => void;
}

export function TransactionInFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: TransactionInFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [workTypes, setWorkTypes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchReferences();
      
      if (initialData) {
        setFormData({
          transaction_no: initialData.transaction_no || "",
          transaction_date: initialData.transaction_date ? initialData.transaction_date.split("T")[0] : "",
          reference_no: initialData.reference_no || "",
          vendor_id: initialData.vendor_id ? String(initialData.vendor_id) : "",
          work_type_id: initialData.work_type_id ? String(initialData.work_type_id) : "",
          notes: initialData.notes || "",
          status: initialData.status || "completed",
        });
      } else {
        setFormData(EMPTY);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const fetchReferences = async () => {
    try {
      const [vendorsRes, workTypesRes] = await Promise.all([
        supabase.from("vendors").select("id, name").eq("status", "active").order("name"),
        supabase.from("work_types").select("id, name").eq("status", "active").order("name"),
      ]);

      if (vendorsRes.data) setVendors(vendorsRes.data as any[]);
      if (workTypesRes.data) setWorkTypes(workTypesRes.data as any[]);
    } catch (err) {
      console.error("Gagal mengambil referensi:", err);
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsed = schema.parse(formData);
      setLoading(true);

      const payload = {
        type: "IN",
        transaction_no: parsed.transaction_no,
        transaction_date: parsed.transaction_date,
        reference_no: parsed.reference_no || null,
        vendor_id: parseInt(parsed.vendor_id),
        work_type_id: parsed.work_type_id ? parseInt(parsed.work_type_id) : null,
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
          if (error.code === '23505') throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }

        await logActivity(
          "UPDATE",
          "Barang Masuk",
          `Memperbarui transaksi masuk: ${parsed.transaction_no}`
        );
        toast.success("Transaksi berhasil diperbarui");
      } else {
        // Create
        const { error } = await supabase.from("inventory_transactions").insert(payload);

        if (error) {
          if (error.code === '23505') throw new Error("Nomor transaksi sudah digunakan");
          throw error;
        }

        await logActivity(
          "CREATE",
          "Barang Masuk",
          `Mencatat transaksi masuk baru: ${parsed.transaction_no}`
        );
        toast.success("Transaksi baru berhasil dicatat");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[e.path[0].toString()] = e.message;
        });
        setErrors(fieldErrors);
      } else {
        console.error("Error saving transaction:", err);
        toast.error(err.message || "Terjadi kesalahan saat menyimpan transaksi");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Barang Masuk" : "Catat Barang Masuk"}
          </DialogTitle>
          <DialogDescription>
            Isi detail transaksi penerimaan atau masuknya barang ke inventaris.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction_no">No. Transaksi <span className="text-destructive">*</span></Label>
              <Input
                id="transaction_no"
                placeholder="Misal: TRXI-2023-001"
                value={formData.transaction_no}
                onChange={(e) => handleChange("transaction_no", e.target.value.toUpperCase())}
              />
              {errors.transaction_no && <p className="text-xs text-destructive">{errors.transaction_no}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction_date">Tanggal Masuk <span className="text-destructive">*</span></Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => handleChange("transaction_date", e.target.value)}
              />
              {errors.transaction_date && <p className="text-xs text-destructive">{errors.transaction_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_id">Penyedia <span className="text-destructive">*</span></Label>
              <Select
                value={formData.vendor_id}
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
              {errors.work_type_id && <p className="text-xs text-destructive">{errors.work_type_id}</p>}
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
            {errors.reference_no && <p className="text-xs text-destructive">{errors.reference_no}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan Tambahan</Label>
            <Textarea
              id="notes"
              placeholder="Keterangan kondisi penerimaan..."
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              className="resize-none"
            />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => handleChange("status", val)}
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

          <DialogFooter className="pt-4">
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
              Simpan Data
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
