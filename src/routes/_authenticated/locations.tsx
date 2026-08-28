import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, Loader2, MapPin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { useLocationsWithCount, type LocationWithCount } from "@/hooks/useAssets";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({
    meta: [
      { title: "Lokasi Aset - MINDSET Diskominfo" },
      { name: "description", content: "Master data lokasi dan ruangan penempatan aset." },
      { property: "og:title", content: "Lokasi Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Master data lokasi dan ruangan penempatan aset." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const { data: locations = [], isPending } = useLocationsWithCount();
  const [search, setSearch] = useState("");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [selectedLocation, setSelectedLocation] = useState<LocationWithCount | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    building: "",
    room: "",
    description: "",
  });

  const filteredData = locations.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.building && item.building.toLowerCase().includes(search.toLowerCase())) ||
      (item.room && item.room.toLowerCase().includes(search.toLowerCase()))
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const code = formData.code.trim().toUpperCase();
      const name = formData.name.trim();
      const building = formData.building.trim() || null;
      const room = formData.room.trim() || null;
      const description = formData.description.trim() || null;

      if (!code || !name) throw new Error("Kode Lokasi dan Nama Lokasi wajib diisi");

      const { data, error } = await supabase
        .from("locations")
        .insert({
          code,
          name,
          building,
          room,
          description,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        action: "CREATE",
        module: "locations",
        tableName: "locations",
        recordId: String(data.id),
        description: `Menambahkan lokasi baru: ${name} (${code})`,
      });
    },
    onSuccess: () => {
      toast.success("Lokasi berhasil ditambahkan");
      setIsAddOpen(false);
      setFormData({ code: "", name: "", building: "", room: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menambahkan lokasi");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation) return;
      const code = formData.code.trim().toUpperCase();
      const name = formData.name.trim();
      const building = formData.building.trim() || null;
      const room = formData.room.trim() || null;
      const description = formData.description.trim() || null;

      if (!code || !name) throw new Error("Kode Lokasi dan Nama Lokasi wajib diisi");

      const { error } = await supabase
        .from("locations")
        .update({ code, name, building, room, description })
        .eq("id", selectedLocation.id);

      if (error) throw error;

      await logActivity({
        action: "UPDATE",
        module: "locations",
        tableName: "locations",
        recordId: String(selectedLocation.id),
        description: `Memperbarui lokasi: ${name} (${code})`,
      });
    },
    onSuccess: () => {
      toast.success("Lokasi berhasil diperbarui");
      setIsEditOpen(false);
      setSelectedLocation(null);
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui lokasi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocation) return;

      if (selectedLocation.count > 0) {
        throw new Error(
          `Lokasi tidak dapat dihapus karena masih digunakan oleh ${selectedLocation.count} aset.`
        );
      }

      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("id", selectedLocation.id);

      if (error) throw error;

      await logActivity({
        action: "DELETE",
        module: "locations",
        tableName: "locations",
        recordId: String(selectedLocation.id),
        description: `Menghapus lokasi: ${selectedLocation.name}`,
      });
    },
    onSuccess: () => {
      toast.success("Lokasi berhasil dihapus");
      setIsDeleteOpen(false);
      setSelectedLocation(null);
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus lokasi");
    },
  });

  const openEdit = (loc: LocationWithCount) => {
    setSelectedLocation(loc);
    setFormData({
      code: loc.code,
      name: loc.name,
      building: loc.building || "",
      room: loc.room || "",
      description: loc.description || "",
    });
    setIsEditOpen(true);
  };

  const openDelete = (loc: LocationWithCount) => {
    setSelectedLocation(loc);
    setIsDeleteOpen(true);
  };

  return (
    <ModuleGuard module="locations">
      <div className="space-y-6">
        <PageHeader 
          title="Lokasi Aset" 
          description="Daftar lokasi penempatan aset Diskominfo" 
          actions={
            <Button
              onClick={() => {
                setFormData({ code: "", name: "", building: "", room: "", description: "" });
                setIsAddOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Lokasi
            </Button>
          }
        />
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama atau kode lokasi..." 
              className="pl-9 h-11 bg-background" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          {isPending ? (
            <div className="p-6 space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold text-xs text-muted-foreground w-28">KODE LOKASI</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">NAMA LOKASI</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">GEDUNG / RUANG</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">DESKRIPSI</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground text-center w-32">JUMLAH ASET</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-bold text-sm text-primary">{loc.code}</TableCell>
                      <TableCell className="font-bold text-sm text-foreground">{loc.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[loc.building, loc.room].filter(Boolean).join(" | ") || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{loc.description || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold border-transparent"
                        >
                          {loc.count} Aset
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(loc)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => openDelete(loc)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <MapPin className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                      Tidak ada lokasi yang ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Dialog Tambah Lokasi */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Lokasi</DialogTitle>
              <DialogDescription>
                Tambahkan lokasi baru untuk penempatan aset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Kode Lokasi</Label>
                <Input
                  id="code"
                  placeholder="Contoh: R-INF"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nama Lokasi</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Ruang Bidang Informatika"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="building" className="text-right">Gedung</Label>
                <Input
                  id="building"
                  placeholder="Contoh: Gedung Diskominfo"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="room" className="text-right">Ruangan</Label>
                <Input
                  id="room"
                  placeholder="Contoh: Informatika"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi singkat lokasi..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Edit Lokasi */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Lokasi</DialogTitle>
              <DialogDescription>
                Ubah data lokasi aset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-code" className="text-right">Kode Lokasi</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Nama Lokasi</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-building" className="text-right">Gedung</Label>
                <Input
                  id="edit-building"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-room" className="text-right">Ruangan</Label>
                <Input
                  id="edit-room"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">Deskripsi</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                {editMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Hapus Lokasi */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Lokasi?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini tidak dapat dibatalkan. Ini akan menghapus lokasi{" "}
                <span className="font-semibold text-foreground">{selectedLocation?.name}</span> secara permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ModuleGuard>
  );
}
