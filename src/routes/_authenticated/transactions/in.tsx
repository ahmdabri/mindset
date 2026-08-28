import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Eye, ArrowDownToLine, Calendar, Building2 } from "lucide-react";

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
import { TransactionInFormDialog } from "@/components/transactions/TransactionInFormDialog";

export interface Vendor {
  name: string;
}

interface WorkType {
  name: string;
}

interface Transaction {
  id: string;
  transaction_no: string;
  transaction_date: string;
  reference_no: string | null;
  status: string;
  vendors: Vendor | null;
  work_types: WorkType | null;
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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(
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
          reference_no,
          status,
          vendor_id,
          work_type_id,
          notes,
          vendors ( name ),
          work_types ( name )
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

  const filteredData = transactions.filter(
    (item) =>
      item.transaction_no.toLowerCase().includes(search.toLowerCase()) ||
      (item.reference_no && item.reference_no.toLowerCase().includes(search.toLowerCase())) ||
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
                setSelectedTransaction(undefined);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Catat Barang Masuk
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor transaksi, referensi, atau penyedia..."
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
                <TableHead className="font-semibold text-xs text-muted-foreground w-40">
                  NO TRANSAKSI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-40">
                  TANGGAL
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  PENYEDIA / PEKERJAAN
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
                      <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-16 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <TableRow key={trx.id}>
                    <TableCell className="font-bold text-sm text-primary">
                      <div className="flex items-center gap-2">
                        <ArrowDownToLine className="size-4 text-green-600" />
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
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Belum ada riwayat transaksi barang masuk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TransactionInFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedTransaction}
        onSuccess={fetchTransactions}
      />
    </ModuleGuard>
  );
}
