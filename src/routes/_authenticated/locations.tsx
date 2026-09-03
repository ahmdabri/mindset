import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, MapPin } from "lucide-react";
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
import { useLocationsWithCount, type LocationWithCount } from "@/hooks/useAssets";
import { LocationFormDialog } from "@/components/locations/LocationFormDialog";

export const Route = createFileRoute("/_authenticated/locations")({
  head: () => ({
    meta: [
      { title: "Lokasi Aset - MINDSET Diskominfo" },
      { name: "description", content: "Master data lokasi dan ruangan." },
      { property: "og:title", content: "Lokasi Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Master data lokasi dan ruangan." },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: locations = [], isPending, isError, refetch } = useLocationsWithCount();

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithCount | null>(null);

  // Delete State
  const [toDelete, setToDelete] = useState<LocationWithCount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = locations.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.building && item.building.toLowerCase().includes(search.toLowerCase())) ||
      (item.room && item.room.toLowerCase().includes(search.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase())),
  );

  async function handleDelete() {
    if (!toDelete) return;

    if (toDelete.count > 0) {
      toast.error(
        `Lokasi "${toDelete.name}" tidak dapat dihapus karena masih digunakan oleh ${toDelete.count} aset.`,
      );
      setToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from("locations").delete().eq("id", toDelete.id);
      if (error) throw error;

      await logActivity({
        action: "DELETE",
        module: "locations",
        tableName: "locations",
        recordId: String(toDelete.id),
        description: `Menghapus lokasi aset: ${toDelete.name} (${toDelete.code})`,
      });

      toast.success("Lokasi berhasil dihapus");
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus lokasi");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModuleGuard module="locations">
      <div className="space-y-6">
        <PageHeader
          title="Lokasi Aset"
          description="Daftar lokasi penempatan aset Diskominfo"
          actions={
            <Button
              onClick={() => {
                setSelectedLocation(null);
                setIsDialogOpen(true);
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
              placeholder="Cari nama, kode, gedung, atau ruangan lokasi..."
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
                  NAMA LOKASI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  GEDUNG / RUANGAN
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
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-40" />
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
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    Gagal memuat data lokasi.
                  </TableCell>
                </TableRow>
              ) : filteredData.length > 0 ? (
                filteredData.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-bold text-sm text-primary">{loc.code}</TableCell>
                    <TableCell className="font-bold text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {loc.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>
                        {loc.building || "-"}
                        {loc.floor ? ` - ${loc.floor}` : ""}
                        {loc.room ? ` (${loc.room})` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loc.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold border-transparent"
                      >
                        {loc.count} Aset
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          loc.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-transparent"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-transparent"
                        }
                      >
                        {loc.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setSelectedLocation(loc);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(loc)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Tidak ada lokasi yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <LocationFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          initialData={selectedLocation}
          onSuccess={() => {
            void refetch();
          }}
        />

        <AlertDialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus lokasi ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Lokasi <span className="font-semibold text-foreground">{toDelete?.name}</span> (
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
