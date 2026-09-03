import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCategoriesWithCount, type CategoryWithCount } from "@/hooks/useAssets";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({
    meta: [
      { title: "Kategori Aset - MINDSET Diskominfo" },
      { name: "description", content: "Master data kategori aset." },
      { property: "og:title", content: "Kategori Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Master data kategori aset." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: categories = [], isPending, isError, refetch } = useCategoriesWithCount();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);

  // Delete State
  const [toDelete, setToDelete] = useState<CategoryWithCount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = categories.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase())),
  );

  async function handleDelete() {
    if (!toDelete) return;

    if (toDelete.count > 0) {
      toast.error(
        `Kategori "${toDelete.name}" tidak dapat dihapus karena masih digunakan oleh ${toDelete.count} aset.`,
      );
      setToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from("categories").delete().eq("id", toDelete.id);
      if (error) throw error;

      await logActivity({
        action: "DELETE",
        module: "categories",
        tableName: "categories",
        recordId: String(toDelete.id),
        description: `Menghapus kategori aset: ${toDelete.name} (${toDelete.code})`,
      });

      toast.success("Kategori berhasil dihapus");
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus kategori");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModuleGuard module="categories">
      <div className="space-y-6">
        <PageHeader
          title="Kategori Aset"
          description="Daftar kategori pengelompokan aset Diskominfo"
          actions={
            <Button
              onClick={() => {
                setSelectedCategory(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Kategori
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, kode, atau deskripsi kategori..."
              className="pl-9 h-11 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-xs text-muted-foreground w-28">
                  KODE
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  NAMA KATEGORI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  DESKRIPSI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-32">
                  JUMLAH ASET
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">
                  STATUS
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">
                  AKSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-6 w-14 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-8 w-16 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    Gagal memuat data kategori.
                  </TableCell>
                </TableRow>
              ) : filteredData.length > 0 ? (
                filteredData.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-bold text-sm text-primary">{cat.code}</TableCell>
                    <TableCell className="font-bold text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Tag className="size-3.5 text-muted-foreground" />
                        {cat.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold border-transparent"
                      >
                        {cat.count} Aset
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          cat.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-transparent"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-transparent"
                        }
                      >
                        {cat.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(cat)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Tidak ada kategori yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <CategoryFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          initialData={selectedCategory}
          onSuccess={() => {
            void refetch();
          }}
        />

        <AlertDialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus kategori ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Kategori <span className="font-semibold text-foreground">{toDelete?.name}</span> (
                {toDelete?.code}) akan dihapus secara permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ModuleGuard>
  );
}
