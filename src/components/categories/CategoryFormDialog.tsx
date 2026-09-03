import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

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
  code: z.string().trim().min(2, "Kode kategori minimal 2 karakter").max(20, "Maksimal 20 karakter"),
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(100, "Maksimal 100 karakter"),
  description: z.string().trim().max(500, "Maksimal 500 karakter").optional(),
  status: z.enum(["active", "inactive"]),
});

type CategoryStatus = "active" | "inactive";

type CategoryFormState = {
  code: string;
  name: string;
  description: string;
  status: CategoryStatus;
};

type CategoryFormErrors = Partial<Record<keyof CategoryFormState, string>>;

export interface CategoryInitialData {
  id?: number;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: CategoryStatus | string | null;
}

const EMPTY: CategoryFormState = {
  code: "",
  name: "",
  description: "",
  status: "active",
};

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: CategoryInitialData | null;
  onSuccess: () => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: CategoryFormDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CategoryFormState>(EMPTY);
  const [errors, setErrors] = useState<CategoryFormErrors>({});

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          code: initialData.code || "",
          name: initialData.name || "",
          description: initialData.description || "",
          status: (initialData.status as CategoryStatus) || "active",
        });
      } else {
        setFormData(EMPTY);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const handleChange = <K extends keyof CategoryFormState>(
    field: K,
    value: CategoryFormState[K],
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
        code: parsed.code.toUpperCase(),
        name: parsed.name,
        description: parsed.description || null,
        status: parsed.status,
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", initialData.id);

        if (error) {
          if (error.code === "23505") throw new Error("Kode kategori sudah digunakan.");
          throw error;
        }

        await logActivity({
          action: "UPDATE",
          module: "categories",
          tableName: "categories",
          recordId: String(initialData.id),
          description: `Memperbarui kategori aset: ${parsed.name} (${payload.code})`,
        });
        toast.success("Kategori berhasil diperbarui");
      } else {
        // Create
        const { error } = await supabase.from("categories").insert(payload);

        if (error) {
          if (error.code === "23505") throw new Error("Kode kategori sudah digunakan.");
          throw error;
        }

        await logActivity({
          action: "CREATE",
          module: "categories",
          tableName: "categories",
          description: `Menambahkan kategori aset baru: ${parsed.name} (${payload.code})`,
        });
        toast.success("Kategori baru berhasil ditambahkan");
      }

      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: CategoryFormErrors = {};
        err.errors.forEach((e) => {
          const key = e.path[0];
          if (typeof key === "string") {
            fieldErrors[key as keyof CategoryFormState] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan data kategori");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Kategori Aset" : "Tambah Kategori Aset"}</DialogTitle>
          <DialogDescription>
            {initialData
              ? "Perbarui informasi data kategori aset di bawah ini."
              : "Masukkan informasi data kategori aset baru."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs font-semibold">
              Kode Kategori <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="Contoh: KOM, ELK, KAT-KOM"
              value={formData.code}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              className={errors.code ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">
              Nama Kategori <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Contoh: Komputer, Elektronik, Furnitur"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Deskripsi
            </Label>
            <Textarea
              id="description"
              placeholder="Keterangan singkat mengenai kategori aset ini..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="resize-none"
              rows={3}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val: CategoryStatus) => handleChange("status", val)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
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
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {initialData ? "Simpan Perubahan" : "Tambah Kategori"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
