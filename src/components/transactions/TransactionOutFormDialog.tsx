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
  destination: z.string().trim().min(3, "Tujuan / Lokasi / Peminjam wajib diisi").max(200),
  work_type_id: z.string().optional(),
  item_status: z.enum(["dipinjam", "dipindah", "selesai", "draft"]),
  notes: z.string().trim().max(1000).optional(),
});

interface FormState {
  transaction_no: string;
  transaction_date: string;
  destination: string;
  work_type_id: string;
  item_status: "dipinjam" | "dipindah" | "selesai" | "draft";
  notes: string;
}

interface FormErrors {
  transaction_no?: string;
  transaction_date?: string;
  destination?: string;
  work_type_id?: string;
  notes?: string;
}

const EMPTY: FormState = {
  transaction_no: "",
  transaction_date: new Date().toISOString().split("T")[0] || "",
  destination: "",
  work_type_id: "",
  item_status: "dipindah",
  notes: "",
};

export interface TransactionOutData {
  id?: string;
  transaction_no?: string;
  transaction_date?: string;
  destination?: string | null;
  work_type_id?: number | string | null;
  notes?: string | null;
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

export function TransactionOutFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: TransactionOutFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});

  const [workTypes, setWorkTypes] = useState<WorkTypeItem[]>([]);

  useEffect(() => {
    if (open) {
      void fetchReferences();

      if (initialData) {
        setFormData({
          transaction_no: initialData.transaction_no || "",
          transaction_date: initialData.transaction_date
            ? initialData.transaction_date.split("T")[0] || ""
            : "",
          destination: initialData.destination || "",
          work_type_id: initialData.work_type_id ? String(initialData.work_type_id) : "",
          item_status:
            initialData.status === "dipinjam" ||
            initialData.status === "dipindah" ||
            initialData.status === "selesai" ||
            initialData.status === "draft"
              ? initialData.status
              : "dipindah",
          notes: initialData.notes || "",
        });
      } else {
        const autoNo = `TRX-OUT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
        setFormData({
          ...EMPTY,
          transaction_no: autoNo,
        });
      }
      setErrors({});
    }
  }, [open, initialData]);

  const fetchReferences = async () => {
    try {
      const { data } = await supabase.from("work_types").select("id, name").order("name");

      if (data) setWorkTypes(data as unknown as WorkTypeItem[]);
    } catch (err) {
      console.error("Gagal mengambil referensi:", err);
    }
  };

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsed = schema.parse(formData);
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
          module: "transactions-out",
          tableName: "inventory_transactions",
          recordId: initialData.id,
          description: `Memperbarui transaksi keluar: ${parsed.transaction_no} (${finalStatus})`,
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
          module: "transactions-out",
          tableName: "inventory_transactions",
          recordId: newTrx?.id,
          description: `Mencatat barang keluar: ${parsed.transaction_no} (${finalStatus})`,
        });
        toast.success("Transaksi barang keluar berhasil dicatat");
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Barang Keluar" : "Catat Barang Keluar"}</DialogTitle>
          <DialogDescription>
            Pencatatan pengeluaran barang untuk mutasi (dipindah) atau peminjaman (dipinjam).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          {/* Status Barang (Dipinjam vs Dipindah) */}
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <Label className="text-sm font-semibold">
              Status / Jenis Pengeluaran <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.item_status}
              onValueChange={(val: "dipinjam" | "dipindah" | "selesai" | "draft") =>
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
                <SelectItem value="selesai">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Selesai (Distribusi / Terkirim)
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
              {formData.item_status === "selesai" &&
                "Barang berstatus terdistribusi / selesai keluar."}
            </p>
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="destination">
              {formData.item_status === "dipinjam"
                ? "Nama Peminjam / Unit Peminjam"
                : "Tujuan / Lokasi / Ruangan Baru"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="destination"
              placeholder={
                formData.item_status === "dipinjam"
                  ? "Misal: Ahmad Dani (Bidang Informatika)"
                  : "Misal: Ruang Server Lt. 2 / Bidang E-Gov"
              }
              value={formData.destination}
              onChange={(e) => handleChange("destination", e.target.value)}
            />
            {errors.destination ? (
              <p className="text-xs text-destructive">{errors.destination}</p>
            ) : null}
          </div>

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
              placeholder="Jelaskan keperluan peminjaman / alasan perpindahan / estimasi pengembalian..."
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            {errors.notes ? <p className="text-xs text-destructive">{errors.notes}</p> : null}
          </div>

          <DialogFooter className="pt-3">
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
              Simpan Barang Keluar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
