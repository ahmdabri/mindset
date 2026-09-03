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
  code: z.string().trim().min(2, "Kode lokasi minimal 2 karakter").max(20, "Maksimal 20 karakter"),
  name: z
    .string()
    .trim()
    .min(2, "Nama lokasi minimal 2 karakter")
    .max(100, "Maksimal 100 karakter"),
  building: z.string().trim().max(100).optional(),
  floor: z.string().trim().max(50).optional(),
  room: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["active", "inactive"]),
});

type LocationStatus = "active" | "inactive";

type LocationFormState = {
  code: string;
  name: string;
  building: string;
  floor: string;
  room: string;
  description: string;
  status: LocationStatus;
};

type LocationFormErrors = Partial<Record<keyof LocationFormState, string>>;

export interface LocationInitialData {
  id?: number;
  code?: string | null;
  name?: string | null;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  description?: string | null;
  status?: LocationStatus | string | null;
}

const EMPTY: LocationFormState = {
  code: "",
  name: "",
  building: "Gedung Diskominfo",
  floor: "Lantai 1",
  room: "",
  description: "",
  status: "active",
};

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: LocationInitialData | null;
  onSuccess: () => void;
}

export function LocationFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: LocationFormDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LocationFormState>(EMPTY);
  const [errors, setErrors] = useState<LocationFormErrors>({});

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          code: initialData.code || "",
          name: initialData.name || "",
          building: initialData.building || "Gedung Diskominfo",
          floor: initialData.floor || "Lantai 1",
          room: initialData.room || "",
          description: initialData.description || "",
          status: (initialData.status as LocationStatus) || "active",
        });
      } else {
        setFormData(EMPTY);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const handleChange = <K extends keyof LocationFormState>(
    field: K,
    value: LocationFormState[K],
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
        building: parsed.building || null,
        floor: parsed.floor || null,
        room: parsed.room || null,
        description: parsed.description || null,
        status: parsed.status,
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase.from("locations").update(payload).eq("id", initialData.id);

        if (error) {
          if (error.code === "23505") throw new Error("Kode lokasi sudah digunakan.");
          throw error;
        }

        await logActivity({
          action: "UPDATE",
          module: "locations",
          tableName: "locations",
          recordId: String(initialData.id),
          description: `Memperbarui lokasi aset: ${parsed.name} (${payload.code})`,
        });
        toast.success("Lokasi berhasil diperbarui");
      } else {
        // Create
        const { error } = await supabase.from("locations").insert(payload);

        if (error) {
          if (error.code === "23505") throw new Error("Kode lokasi sudah digunakan.");
          throw error;
        }

        await logActivity({
          action: "CREATE",
          module: "locations",
          tableName: "locations",
          description: `Menambahkan lokasi aset baru: ${parsed.name} (${payload.code})`,
        });
        toast.success("Lokasi baru berhasil ditambahkan");
      }

      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: LocationFormErrors = {};
        err.errors.forEach((e) => {
          const key = e.path[0];
          if (typeof key === "string") {
            fieldErrors[key as keyof LocationFormState] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan data lokasi");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Lokasi Aset" : "Tambah Lokasi Aset"}</DialogTitle>
          <DialogDescription>
            {initialData
              ? "Perbarui informasi data penempatan lokasi aset di bawah ini."
              : "Masukkan informasi data lokasi dan ruangan baru."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-semibold">
                Kode Lokasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder="Contoh: LOK-SRV, R-SVR"
                value={formData.code}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                className={errors.code ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Nama Lokasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Contoh: Ruang Server"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="building" className="text-xs font-semibold">
                Gedung
              </Label>
              <Input
                id="building"
                placeholder="Gedung Diskominfo"
                value={formData.building}
                onChange={(e) => handleChange("building", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="floor" className="text-xs font-semibold">
                Lantai
              </Label>
              <Input
                id="floor"
                placeholder="Lantai 1 / 2"
                value={formData.floor}
                onChange={(e) => handleChange("floor", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room" className="text-xs font-semibold">
                Ruangan
              </Label>
              <Input
                id="room"
                placeholder="Ruang Bidang"
                value={formData.room}
                onChange={(e) => handleChange("room", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Deskripsi / Keterangan
            </Label>
            <Textarea
              id="description"
              placeholder="Keterangan penempatan atau fungsi lokasi..."
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
              onValueChange={(val: LocationStatus) => handleChange("status", val)}
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
              {initialData ? "Simpan Perubahan" : "Tambah Lokasi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
