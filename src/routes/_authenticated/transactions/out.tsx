import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  ArrowUpFromLine,
  Calendar,
  MapPin,
  Package,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  TransactionOutFormDialog,
  type TransactionOutData,
} from "@/components/transactions/TransactionOutFormDialog";

export interface WorkType {
  name: string;
}

interface Transaction {
  id: string;
  transaction_no: string;
  transaction_date: string;
  destination: string | null;
  status: string;
  notes: string | null;
  work_type_id: string | null;
  item_name: string | null;
  quantity: number | null;
  asset_id: string | null;
  work_types: WorkType | null;
  assets: { locations: { name: string; room: string | null } | null } | null;
}

export const Route = createFileRoute("/_authenticated/transactions/out")({
  head: () => ({
    meta: [
      { title: "Barang Keluar - MINDSET Diskominfo" },
      { name: "description", content: "Catat transaksi barang keluar." },
    ],
  }),
  component: Page,
});

function Page() {
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionOutData | undefined>(
    undefined,
  );
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchTransactions() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select(
          `
          id,
          transaction_no,
          transaction_date,
          destination,
          status,
          work_type_id,
          notes,
          item_name,
          quantity,
          asset_id,
          work_types ( name ),
          assets ( locations ( name, room ) )
        `,
        )
        .eq("type", "OUT")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions((data as unknown as Transaction[]) || []);
    } catch (err) {
      console.error("Gagal mengambil data barang keluar:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTransactions();
  }, []);

  async function handleDelete() {
    if (!toDelete) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from("inventory_transactions")
        .delete()
        .eq("id", toDelete.id);
      if (error) throw error;

      await logActivity({
        action: "DELETE",
        module: "Barang Keluar",
        tableName: "inventory_transactions",
        recordId: toDelete.id,
        description: `Menghapus riwayat transaksi keluar: ${toDelete.transaction_no} (${toDelete.item_name || "-"})`,
      });

      toast.success("Transaksi barang keluar berhasil dihapus.");
      setToDelete(null);
      void fetchTransactions();
    } catch (err: unknown) {
      console.error("Gagal menghapus transaksi:", err);
      const msg = err instanceof Error ? err.message : "Gagal menghapus transaksi";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  const filteredData = transactions.filter(
    (item) =>
      item.transaction_no.toLowerCase().includes(search.toLowerCase()) ||
      (item.item_name && item.item_name.toLowerCase().includes(search.toLowerCase())) ||
      (item.destination && item.destination.toLowerCase().includes(search.toLowerCase())) ||
      (item.work_types?.name && item.work_types.name.toLowerCase().includes(search.toLowerCase())),
  );

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "dipinjam":
        return (
          <Badge
            variant="secondary"
            className="border-amber-200 bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          >
            Di Pinjam
          </Badge>
        );
      case "dipindah":
        return (
          <Badge
            variant="secondary"
            className="border-blue-200 bg-blue-100 px-2.5 py-1 font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
          >
            Di Pindah
          </Badge>
        );
      case "draft":
        return (
          <Badge
            variant="outline"
            className="border-muted-foreground/30 px-2.5 py-1 text-muted-foreground"
          >
            Draft
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-slate-100 px-2.5 py-1 text-slate-800">
            {status || "-"}
          </Badge>
        );
    }
  };

  return (
    <ModuleGuard module="transactions-out">
      <div className="space-y-6">
        <PageHeader
          title="Barang Keluar"
          description="Pencatatan riwayat transaksi barang keluar: Mutasi (Di Pindah) dan Peminjaman (Di Pinjam)"
          actions={
            <Button
              onClick={() => {
                setSelectedTransaction(undefined);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Barang Keluar
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-(--shadow-card)">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nomor transaksi, nama barang, tujuan / peminjam, atau pekerjaan..."
              className="h-11 bg-background pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-44 text-xs font-semibold text-muted-foreground">
                  NO TRANSAKSI
                </TableHead>
                <TableHead className="w-32 text-xs font-semibold text-muted-foreground">
                  TANGGAL
                </TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">
                  NAMA BARANG
                </TableHead>
                <TableHead className="w-20 text-center text-xs font-semibold text-muted-foreground">
                  JUMLAH
                </TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">
                  TUJUAN / PENERIMA / PEKERJAAN
                </TableHead>
                <TableHead className="w-36 text-center text-xs font-semibold text-muted-foreground">
                  STATUS BARANG
                </TableHead>
                <TableHead className="w-28 text-center text-xs font-semibold text-muted-foreground">
                  AKSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-8 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="text-sm font-bold text-primary">
                      <div className="flex items-center gap-2">
                        <ArrowUpFromLine className="size-4 text-orange-500 shrink-0" />
                        <span>{trx.transaction_no}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {trx.transaction_date
                          ? format(parseISO(trx.transaction_date), "dd MMM yyyy", {
                              locale: localeId,
                            })
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Package className="size-3.5 text-orange-500" />
                        {trx.item_name || <span className="text-muted-foreground italic">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 font-semibold text-sm">
                        <span>{trx.quantity ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <MapPin className="size-3.5 text-primary" />
                          {trx.destination || "Tidak ada tujuan spesifik"}
                        </div>
                        {trx.work_types?.name ? (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Pekerjaan: {trx.work_types.name}
                          </div>
                        ) : null}
                        {trx.notes ? (
                          <div className="line-clamp-1 text-xs italic text-muted-foreground">
                            Ket: {trx.notes}
                          </div>
                        ) : null}
                        {trx.assets?.locations && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-400">
                            Lokasi aset: {trx.assets.locations.name}
                            {trx.assets.locations.room ? ` - ${trx.assets.locations.room}` : ""}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(trx.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Lihat Detail"
                          onClick={() => setViewingTransaction(trx)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Edit"
                          onClick={() => {
                            setSelectedTransaction({
                              id: trx.id,
                              transaction_no: trx.transaction_no,
                              transaction_date: trx.transaction_date,
                              asset_id: trx.asset_id,
                              item_name: trx.item_name,
                              quantity: trx.quantity,
                              destination: trx.destination,
                              work_type_id: trx.work_type_id,
                              notes: trx.notes,
                              status: trx.status,
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Hapus Transaksi"
                          onClick={() => setToDelete(trx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Belum ada riwayat transaksi barang keluar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Form Tambah / Edit */}
      <TransactionOutFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedTransaction}
        onSuccess={fetchTransactions}
      />

      {/* Dialog Detail Transaksi Keluar */}
      <Dialog
        open={Boolean(viewingTransaction)}
        onOpenChange={(v) => !v && setViewingTransaction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="size-5 text-orange-500" />
              Detail Barang Keluar
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap transaksi pengeluaran / mutasi / peminjaman barang.
            </DialogDescription>
          </DialogHeader>
          {viewingTransaction && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">No. Transaksi</span>
                <span className="font-bold text-primary font-mono">
                  {viewingTransaction.transaction_no}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Tanggal Transaksi</span>
                <span className="font-medium">
                  {viewingTransaction.transaction_date
                    ? format(parseISO(viewingTransaction.transaction_date), "dd MMMM yyyy", {
                        locale: localeId,
                      })
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Nama Barang</span>
                <span className="font-semibold text-foreground">
                  {viewingTransaction.item_name || "-"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Jumlah Barang</span>
                <span className="font-bold text-foreground">
                  {viewingTransaction.quantity ?? 1} unit
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Tujuan / Penerima</span>
                <span className="font-semibold text-foreground">
                  {viewingTransaction.destination || "-"}
                </span>
              </div>
              {viewingTransaction.assets?.locations && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Lokasi Aset Saat Ini</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {viewingTransaction.assets.locations.name}
                    {viewingTransaction.assets.locations.room
                      ? ` - ${viewingTransaction.assets.locations.room}`
                      : ""}
                  </span>
                </div>
              )}
              {viewingTransaction.work_types?.name && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Jenis Pekerjaan</span>
                  <span>{viewingTransaction.work_types.name}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Status / Jenis</span>
                <div>{getStatusBadge(viewingTransaction.status)}</div>
              </div>
              {viewingTransaction.notes && (
                <div className="space-y-1 pt-1">
                  <span className="text-muted-foreground text-xs font-medium">Catatan:</span>
                  <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-foreground italic">
                    {viewingTransaction.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTransaction(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Konfirmasi Hapus */}
      <AlertDialog open={Boolean(toDelete)} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Riwayat Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi{" "}
              <span className="font-semibold text-foreground">{toDelete?.transaction_no}</span> (
              {toDelete?.item_name || "Barang"}) akan dihapus dari riwayat transaksi barang keluar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus Transaksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleGuard>
  );
}
