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
  code: z.string().trim().min(2, "Kode minimal 2 karakter").max(30),
  name: z.string().trim().min(3, "Nama pekerjaan minimal 3 karakter").max(150),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(["active", "inactive"]),
});

type WorkTypeStatus = "active" | "inactive";

type WorkTypeFormState = {
  code: string;
  name: string;
  description: string;
  status: WorkTypeStatus;
};

type WorkTypeFormErrors = Partial<Record<keyof WorkTypeFormState, string>>;

type WorkTypeInitialData = {
  id?: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: WorkTypeStatus | null;
};

const EMPTY: WorkTypeFormState = {
  code: "",
  name: "",
  description: "",
  status: "active",
};

interface WorkTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: WorkTypeInitialData | null;
  onSuccess: () => void;
}

export function WorkTypeFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: WorkTypeFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<WorkTypeFormState>(EMPTY);
  const [errors, setErrors] = useState<WorkTypeFormErrors>({});

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          code: initialData.code || "",
          name: initialData.name || "",
          description: initialData.description || "",
          status: initialData.status || "active",
        });
      } else {
        setFormData(EMPTY);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const handleChange = <K extends keyof WorkTypeFormState>(
    field: K,
    value: WorkTypeFormState[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsed = schema.parse(formData);
      setLoading(true);

      const payload = {
        code: parsed.code,
        name: parsed.name,
        description: parsed.description || null,
        status: parsed.status,
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("work_types")
          .update(payload)
          .eq("id", initialData.id);

        if (error) {
          if (error.code === "23505") throw new Error("Kode pekerjaan sudah digunakan");
          throw error;
        }

        await logActivity({
          action: "UPDATE",
          module: "Jenis Pekerjaan",
          tableName: "work_types",
          recordId: initialData.id,
          description: `Memperbarui jenis pekerjaan: ${parsed.name}`,
        });
        toast.success("Jenis pekerjaan berhasil diperbarui");
      } else {
        // Create
        const { error } = await supabase.from("work_types").insert(payload);

        if (error) {
          if (error.code === "23505") throw new Error("Kode pekerjaan sudah digunakan");
          throw error;
        }

        await logActivity({
          action: "CREATE",
          module: "Jenis Pekerjaan",
          tableName: "work_types",
          description: `Menambahkan jenis pekerjaan baru: ${parsed.name}`,
        });
        toast.success("Jenis pekerjaan baru berhasil ditambahkan");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: WorkTypeFormErrors = {};
        err.errors.forEach((e) => {
          const key = e.path[0];
          if (typeof key === "string") {
            fieldErrors[key as keyof WorkTypeFormState] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error("Error saving work type:", err);
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Jenis Pekerjaan" : "Tambah Pekerjaan Baru"}
          </DialogTitle>
          <DialogDescription>Tentukan kode dan nama referensi jenis pekerjaan.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">
              Kode Pekerjaan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="Misal: PENGADAAN-2023"
              value={formData["code"]}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
            />
            {errors["code"] && <p className="text-xs text-destructive">{errors["code"]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Pekerjaan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Pengadaan Komputer..."
              value={formData["name"]}
              onChange={(e) => handleChange("name", e.target.value)}
            />
            {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi / Keterangan</Label>
            <Textarea
              id="description"
              placeholder="Catatan tambahan (opsional)..."
              value={formData["description"]}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
              className="resize-none"
            />
            {errors["description"] && (
              <p className="text-xs text-destructive">{errors["description"]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData["status"]}
              onValueChange={(val) => handleChange("status", val as WorkTypeStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
            {errors["status"] && <p className="text-xs text-destructive">{errors["status"]}</p>}
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
