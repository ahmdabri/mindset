import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Package, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { useAssetList, useCategories, useLocations, type AssetListRow } from "@/hooks/useAssets";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canWriteAssets } from "@/lib/permissions";
import { formatDate, formatRupiah } from "@/lib/format";
import {
  CONDITION_OPTIONS,
  STATUS_OPTIONS,
  conditionBadgeClass,
  conditionLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/asset-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Data Aset - MINDSET Diskominfo" },
      { name: "description", content: "Kelola seluruh aset yang dimiliki Diskominfo." },
      { property: "og:title", content: "Data Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Kelola seluruh aset yang dimiliki Diskominfo." },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 10;

function Page() {
  return (
    <ModuleGuard module="assets">
      <AssetsView />
    </ModuleGuard>
  );
}

function AssetsView() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const canEdit = canWriteAssets(user?.role);
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [condition, setCondition] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AssetListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filters = { search, categoryId, locationId, condition, status, page, pageSize: PAGE_SIZE };
  const { data, isPending, isError } = useAssetList(filters);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter =
    search !== "" ||
    categoryId !== "all" ||
    locationId !== "all" ||
    condition !== "all" ||
    status !== "all";

  function resetFilters() {
    setSearch("");
    setCategoryId("all");
    setLocationId("all");
    setCondition("all");
    setStatus("all");
    setPage(1);
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("assets")
      .update({ deleted_at: new Date().toISOString(), asset_status: "dihapus" })
      .eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Gagal menghapus aset");
      return;
    }
    await logActivity({
      action: "DELETE",
      module: "assets",
      tableName: "assets",
      recordId: toDelete.id,
      description: `Menghapus aset ${toDelete.asset_code} - ${toDelete.asset_name}`,
      oldData: toDelete,
    });
    toast.success("Aset berhasil dihapus");
    setToDelete(null);
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
    queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Aset"
        description="Kelola seluruh aset yang dimiliki Diskominfo"
        actions={
          canEdit ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" /> Tambah Aset
            </Button>
          ) : null
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-(--shadow-card)">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, kode, merk, atau nomor seri..."
              className="pl-9"
              maxLength={100}
            />
          </div>

          <FilterSelect
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
            placeholder="Semua Kategori"
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <FilterSelect
            value={locationId}
            onChange={(v) => {
              setLocationId(v);
              setPage(1);
            }}
            placeholder="Semua Lokasi"
            options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
          />
          <FilterSelect
            value={condition}
            onChange={(v) => {
              setCondition(v);
              setPage(1);
            }}
            placeholder="Semua Kondisi"
            options={CONDITION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            placeholder="Semua Status"
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={!hasFilter}
            className="shrink-0"
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)">
        <div className="overflow-x-auto">
          <Table className="min-w-245">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-52">Kode / Nama</TableHead>
                <TableHead className="min-w-28">Kategori</TableHead>
                <TableHead className="min-w-36">Lokasi</TableHead>
                <TableHead className="min-w-24">Kondisi</TableHead>
                <TableHead className="min-w-24">Status</TableHead>
                <TableHead className="min-w-32">Perolehan</TableHead>
                <TableHead className="min-w-24">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-destructive">
                    Gagal memuat data aset. Coba muat ulang halaman.
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center">
                    <Package className="mx-auto size-9 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      {hasFilter ? "Tidak ada aset yang cocok" : "Belum ada data aset"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasFilter
                        ? "Ubah atau reset filter pencarian."
                        : canEdit
                          ? "Mulai dengan menambahkan aset pertama."
                          : "Data akan tampil setelah operator menambahkan aset."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="align-middle">
                    <TableCell className="py-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/assets/$id"
                            params={{ id: row.id }}
                            className="max-w-[18rem] truncate font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {row.asset_name}
                          </Link>
                          {row.quantity !== undefined && (
                            <Badge
                              variant="secondary"
                              className={`shrink-0 px-1.5 py-0 text-[10px] font-semibold ${
                                row.quantity > 0
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              Stok {row.quantity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.asset_code}
                          {row.brand ? ` • ${row.brand}` : ""}
                        </p>
                        {row.description?.startsWith("Hasil pemindahan") ? (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            {row.description}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm">{row.categories?.name ?? "-"}</TableCell>
                    <TableCell className="py-3 text-sm">
                      <div className="space-y-0.5">
                        <div>{row.locations?.name ?? "-"}</div>
                        {row.locations?.room ? (
                          <div className="text-xs text-muted-foreground">{row.locations.room}</div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={conditionBadgeClass(row.condition_status)}
                      >
                        {conditionLabel(row.condition_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={statusBadgeClass(row.asset_status)}>
                        {statusLabel(row.asset_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <div className="space-y-0.5">
                        <div>{formatRupiah(row.acquisition_price)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(row.acquisition_date)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-24 py-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          aria-label="Lihat detail"
                          className="h-8 w-8"
                        >
                          <Link to="/assets/$id" params={{ id: row.id }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>

                        {canEdit ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Hapus aset"
                            onClick={() => setToDelete(row)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `Menampilkan ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} dari ${total} aset`
              : "0 aset"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">
              Hal {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      <AssetFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus aset ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Aset {toDelete?.asset_code} akan diarsipkan dan tidak lagi tampil pada daftar. Riwayat
              transaksi tetap tersimpan untuk keperluan audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-w-0">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
