import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, ArrowUpFromLine, Calendar, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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
  work_types: WorkType | null;
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
          work_types ( name )
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

  const filteredData = transactions.filter(
    (item) =>
      item.transaction_no.toLowerCase().includes(search.toLowerCase()) ||
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
      case "completed":
      case "selesai":
        return (
          <Badge
            variant="secondary"
            className="border-emerald-200 bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            Selesai
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
              Catat Barang Keluar
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nomor transaksi, tujuan / peminjam, atau pekerjaan..."
              className="h-11 bg-background pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-44 text-xs font-semibold text-muted-foreground">
                  NO TRANSAKSI
                </TableHead>
                <TableHead className="w-36 text-xs font-semibold text-muted-foreground">
                  TANGGAL
                </TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">
                  TUJUAN / PENERIMA / PEKERJAAN
                </TableHead>
                <TableHead className="w-36 text-center text-xs font-semibold text-muted-foreground">
                  STATUS BARANG
                </TableHead>
                <TableHead className="w-24 text-center text-xs font-semibold text-muted-foreground">
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
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-8 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="text-sm font-bold text-primary">
                      <div className="flex items-center gap-2">
                        <ArrowUpFromLine className="size-4 text-orange-500" />
                        {trx.transaction_no}
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
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(trx.status)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setSelectedTransaction({
                              id: trx.id,
                              transaction_no: trx.transaction_no,
                              transaction_date: trx.transaction_date,
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Belum ada riwayat transaksi barang keluar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TransactionOutFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedTransaction}
        onSuccess={fetchTransactions}
      />
    </ModuleGuard>
  );
}
