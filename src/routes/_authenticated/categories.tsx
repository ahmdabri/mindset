import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, Loader2, FolderTree } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { useCategoriesWithCount, type CategoryWithCount } from "@/hooks/useAssets";
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

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({
    meta: [
      { title: "Kategori Aset - MINDSET Diskominfo" },
      { name: "description", content: "Master data kategori aset Diskominfo." },
      { property: "og:title", content: "Kategori Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Master data kategori aset Diskominfo." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const { data: categories = [], isPending } = useCategoriesWithCount();
  const [search, setSearch] = useState("");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", description: "" });

  const filteredData = categories.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const code = formData.code.trim().toUpperCase();
      const name = formData.name.trim();
      const description = formData.description.trim() || null;

      if (!code || !name) throw new Error("Kode dan Nama Kategori wajib diisi");

      const { data, error } = await supabase
        .from("categories")
        .insert({ code, name, description, status: "active" })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        action: "CREATE",
        module: "categories",
        tableName: "categories",
        recordId: String(data.id),
        description: `Menambahkan kategori aset baru: ${name} (${code})`,
      });
    },
    onSuccess: () => {
      toast.success("Kategori berhasil ditambahkan");
      setIsAddOpen(false);
      setFormData({ code: "", name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menambahkan kategori");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCategory) return;
      const code = formData.code.trim().toUpperCase();
      const name = formData.name.trim();
      const description = formData.description.trim() || null;

      if (!code || !name) throw new Error("Kode dan Nama Kategori wajib diisi");

      const { error } = await supabase
        .from("categories")
        .update({ code, name, description })
        .eq("id", selectedCategory.id);

      if (error) throw error;

      await logActivity({
        action: "UPDATE",
        module: "categories",
        tableName: "categories",
        recordId: String(selectedCategory.id),
        description: `Memperbarui kategori aset: ${name} (${code})`,
      });
    },
    onSuccess: () => {
      toast.success("Kategori berhasil diperbarui");
      setIsEditOpen(false);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memperbarui kategori");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCategory) return;

      if (selectedCategory.count > 0) {
        throw new Error(
          `Kategori tidak dapat dihapus karena masih digunakan oleh ${selectedCategory.count} aset.`
        );
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", selectedCategory.id);

      if (error) throw error;

      await logActivity({
        action: "DELETE",
        module: "categories",
        tableName: "categories",
        recordId: String(selectedCategory.id),
        description: `Menghapus kategori aset: ${selectedCategory.name}`,
      });
    },
    onSuccess: () => {
      toast.success("Kategori berhasil dihapus");
      setIsDeleteOpen(false);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menghapus kategori");
    },
  });

  const openEdit = (cat: CategoryWithCount) => {
    setSelectedCategory(cat);
    setFormData({ code: cat.code, name: cat.name, description: cat.description || "" });
    setIsEditOpen(true);
  };

  const openDelete = (cat: CategoryWithCount) => {
    setSelectedCategory(cat);
    setIsDeleteOpen(true);
  };

  return (
    <ModuleGuard module="categories">
      <div className="space-y-6">
        <PageHeader 
          title="Kategori Aset" 
          description="Daftar kategori pengelompokan aset Diskominfo" 
          actions={
            <Button onClick={() => { setFormData({ code: "", name: "", description: "" }); setIsAddOpen(true); }}>
              <Plus className="mr-2 size-4" />
              Tambah Kategori
            </Button>
          }
        />
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama atau kode kategori..." 
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
                  <TableHead className="font-semibold text-xs text-muted-foreground w-28">KODE</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">NAMA KATEGORI</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground">DESKRIPSI</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground text-center w-32">JUMLAH ASET</TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-bold text-sm text-primary">{cat.code}</TableCell>
                      <TableCell className="font-bold text-sm text-foreground">{cat.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cat.description || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold border-transparent"
                        >
                          {cat.count} Aset
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(cat)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => openDelete(cat)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <FolderTree className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                      Tidak ada kategori yang ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Dialog Tambah Kategori */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Kategori</DialogTitle>
              <DialogDescription>
                Tambahkan kategori baru untuk pengelompokan aset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Kode</Label>
                <Input
                  id="code"
                  placeholder="Contoh: INV"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nama Kategori</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Inventaris Kantor"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi singkat kategori..."
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

        {/* Dialog Edit Kategori */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Kategori</DialogTitle>
              <DialogDescription>
                Ubah data kategori aset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-code" className="text-right">Kode</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Nama Kategori</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

        {/* Dialog Hapus Kategori */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini tidak dapat dibatalkan. Ini akan menghapus kategori{" "}
                <span className="font-semibold text-foreground">{selectedCategory?.name}</span> secara permanen.
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
