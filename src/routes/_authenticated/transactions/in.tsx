import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  ArrowDownToLine,
  Calendar,
  Building2,
  Package,
  Tag,
  Hash,
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
import { TransactionInFormDialog } from "@/components/transactions/TransactionInFormDialog";

export interface Vendor {
  id?: string;
  name: string;
}

interface WorkType {
  id?: string;
  name: string;
}

type TransactionStatus = "draft" | "processing" | "completed" | "cancelled";

interface Transaction {
  id: string;
  transaction_no: string;
  transaction_date: string;
  reference_no: string | null;
  item_name: string | null;
  category_id: number | null;
  quantity: number | null;
  vendor_id?: string | number | null;
  work_type_id?: string | number | null;
  notes?: string | null;
  status: TransactionStatus;
  vendors: Vendor | null;
  work_types: WorkType | null;
  categories: { name: string } | null;
}

export const Route = createFileRoute("/_authenticated/transactions/in")({
  head: () => ({
    meta: [
      { title: "Barang Masuk - MINDSET Diskominfo" },
      { name: "description", content: "Catat transaksi barang masuk." },
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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
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
          reference_no,
          item_name,
          category_id,
          quantity,
          status,
          vendor_id,
          work_type_id,
          notes,
          vendors ( name ),
          work_types ( name ),
          categories ( name )
        `,
        )
        .eq("type", "IN")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data as unknown as Transaction[]);
    } catch (err) {
      console.error("Gagal mengambil data barang masuk:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
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
        module: "Barang Masuk",
        tableName: "inventory_transactions",
        recordId: toDelete.id,
        description: `Menghapus riwayat transaksi masuk: ${toDelete.transaction_no} (${toDelete.item_name || "-"})`,
      });

      toast.success("Transaksi barang masuk berhasil dihapus.");
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
      (item.reference_no && item.reference_no.toLowerCase().includes(search.toLowerCase())) ||
      (item.item_name && item.item_name.toLowerCase().includes(search.toLowerCase())) ||
      (item.vendors?.name && item.vendors.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <ModuleGuard module="transactions-in">
      <div className="space-y-6">
        <PageHeader
          title="Barang Masuk"
          description="Pencatatan riwayat transaksi dan penerimaan barang baru"
          actions={
            <Button
              onClick={() => {
                setSelectedTransaction(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Barang Masuk
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-(--shadow-card)">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor transaksi, nama barang, referensi, atau penyedia..."
              className="pl-9 h-11 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-(--shadow-card) overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-xs text-muted-foreground w-44">
                  NO TRANSAKSI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-32">
                  TANGGAL
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  NAMA BARANG
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-36">
                  KATEGORI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-20">
                  JUMLAH
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  PENYEDIA / PEKERJAAN
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">
                  STATUS
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-28">
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-20 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="font-bold text-sm text-primary">
                      <div className="flex items-center gap-2">
                        <ArrowDownToLine className="size-4 text-green-600 shrink-0" />
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
                        <Package className="size-3.5 text-green-600" />
                        {trx.item_name || <span className="text-muted-foreground italic">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {trx.categories?.name ? (
                        <div className="flex items-center gap-1">
                          <Tag className="size-3 text-muted-foreground" />
                          <span className="text-xs">{trx.categories.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center font-semibold text-sm">
                        <span>{trx.quantity ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Building2 className="size-3.5" />
                          {trx.vendors?.name || "Tidak ada penyedia"}
                        </div>
                        {trx.work_types?.name && (
                          <div className="text-xs">Pekerjaan: {trx.work_types.name}</div>
                        )}
                        {trx.reference_no && <div className="text-xs">Ref: {trx.reference_no}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          trx.status === "completed"
                            ? "bg-green-100 text-green-800 border-transparent"
                            : "bg-yellow-100 text-yellow-800 border-transparent"
                        }
                      >
                        {trx.status === "completed" ? "Selesai" : trx.status}
                      </Badge>
                    </TableCell>
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
                            setSelectedTransaction(trx);
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
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Belum ada riwayat transaksi barang masuk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Form Tambah / Edit */}
      <TransactionInFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedTransaction ?? null}
        onSuccess={fetchTransactions}
      />

      {/* Dialog Detail Transaksi */}
      <Dialog
        open={Boolean(viewingTransaction)}
        onOpenChange={(v) => !v && setViewingTransaction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-green-600" />
              Detail Barang Masuk
            </DialogTitle>
            <DialogDescription>Informasi lengkap transaksi penerimaan barang.</DialogDescription>
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
                <span className="text-muted-foreground">Kategori</span>
                <span>{viewingTransaction.categories?.name || "-"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Jumlah Barang</span>
                <span className="font-bold text-foreground">
                  {viewingTransaction.quantity ?? 1} unit
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Penyedia / Vendor</span>
                <span className="font-medium">{viewingTransaction.vendors?.name || "-"}</span>
              </div>
              {viewingTransaction.work_types?.name && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Jenis Pekerjaan</span>
                  <span>{viewingTransaction.work_types.name}</span>
                </div>
              )}
              {viewingTransaction.reference_no && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">No. Referensi / SPK</span>
                  <span>{viewingTransaction.reference_no}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Status Transaksi</span>
                <Badge
                  variant="secondary"
                  className={
                    viewingTransaction.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {viewingTransaction.status === "completed"
                    ? "Selesai"
                    : viewingTransaction.status}
                </Badge>
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
              {toDelete?.item_name || "Barang"}) akan dihapus dari riwayat transaksi barang masuk.
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
