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
  name: z.string().trim().min(3, "Nama penyedia minimal 3 karakter").max(150),
  address: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

type VendorStatus = "active" | "inactive";

type VendorFormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  status: VendorStatus;
};

type VendorFormErrors = Partial<Record<keyof VendorFormState, string>>;

type VendorInitialData = {
  id?: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: VendorStatus | null;
};

const EMPTY: VendorFormState = {
  name: "",
  address: "",
  phone: "",
  email: "",
  status: "active",
};

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: VendorInitialData | null;
  onSuccess: () => void;
}

export function VendorFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: VendorFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<VendorFormState>(EMPTY);
  const [errors, setErrors] = useState<VendorFormErrors>({});

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          name: initialData.name || "",
          address: initialData.address || "",
          phone: initialData.phone || "",
          email: initialData.email || "",
          status: initialData.status || "active",
        });
      } else {
        setFormData(EMPTY);
      }
      setErrors({});
    }
  }, [open, initialData]);

  const handleChange = <K extends keyof VendorFormState>(field: K, value: VendorFormState[K]) => {
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
        name: parsed.name,
        address: parsed.address || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        status: parsed.status,
      };

      if (initialData?.id) {
        // Update
        const { error } = await supabase.from("vendors").update(payload).eq("id", initialData.id);

        if (error) throw error;

        await logActivity({
          action: "UPDATE",
          module: "Penyedia",
          tableName: "vendors",
          recordId: initialData.id,
          description: `Memperbarui data penyedia: ${parsed.name}`,
        });
        toast.success("Data penyedia berhasil diperbarui");
      } else {
        // Create
        const { error } = await supabase.from("vendors").insert(payload);

        if (error) throw error;

        await logActivity({
          action: "CREATE",
          module: "Penyedia",
          tableName: "vendors",
          description: `Menambahkan penyedia baru: ${parsed.name}`,
        });
        toast.success("Penyedia baru berhasil ditambahkan");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        const fieldErrors: VendorFormErrors = {};
        err.errors.forEach((e) => {
          const key = e.path[0];
          if (typeof key === "string") {
            fieldErrors[key as keyof VendorFormState] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error("Error saving vendor:", err);
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
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Penyedia" : "Tambah Penyedia Baru"}</DialogTitle>
          <DialogDescription>
            Isi formulir di bawah ini untuk menyimpan data penyedia pengadaan atau vendor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Penyedia <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="PT. Teknologi Bangsa..."
              value={formData["name"]}
              onChange={(e) => handleChange("name", e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon</Label>
              <Input
                id="phone"
                placeholder="08123456789"
                value={formData["phone"]}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="kontak@vendor.com"
                value={formData["email"]}
                onChange={(e) => handleChange("email", e.target.value)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Alamat</Label>
            <Textarea
              id="address"
              placeholder="Jl. Merdeka No. 123..."
              value={formData["address"]}
              onChange={(e) => handleChange("address", e.target.value)}
              rows={3}
              className="resize-none"
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status Penyedia</Label>
            <Select
              value={formData["status"]}
              onValueChange={(val) => handleChange("status", val as VendorStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
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
