import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Calendar,
  User,
  ArrowLeftRight,
  ClipboardList,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLoansList } from "@/hooks/useAssets";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canWriteAssets } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { CONDITION_OPTIONS, conditionLabel } from "@/lib/asset-options";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [
      { title: "Peminjaman Aset - Mindset Diskominfo" },
      { name: "description", content: "Pencatatan peminjaman dan pengembalian aset." },
      { property: "og:title", content: "Peminjaman Aset - Mindset Diskominfo" },
      { property: "og:description", content: "Pencatatan peminjaman dan pengembalian aset." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="loans">
      <div className="space-y-6">
        <PageHeader
          title="Peminjaman Aset"
          description="Pencatatan peminjaman dan pengembalian aset"
        />
        <LoansView />
      </div>
    </ModuleGuard>
  );
}

const loanSchema = z.object({
  asset_id: z.string().min(1, "Aset wajib dipilih"),
  borrower_name: z.string().trim().min(3, "Nama peminjam minimal 3 karakter").max(150),
  borrower_unit: z.string().trim().max(150).optional(),
  borrower_contact: z.string().trim().max(50).optional(),
  loan_date: z.string().min(1, "Tanggal pinjam wajib diisi"),
  due_date: z.string().min(1, "Batas jatuh tempo wajib diisi"),
  purpose: z.string().trim().max(1000).optional(),
});

interface AvailableAsset {
  id: string;
  asset_code: string;
  asset_name: string;
}

function LoansView() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canEdit = canWriteAssets(currentUser?.role);

  const { data: loans = [], isPending, isError } = useLoansList();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Peminjaman Form State
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerUnit, setBorrowerUnit] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [loanDate, setLoanDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 7 days fallback
  );
  const [purpose, setPurpose] = useState("");

  // Pengembalian Form State
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnCondition, setReturnCondition] = useState("baik");

  // Query assets that are currently 'available' (status === 'tersedia')
  const { data: availableAssets = [] } = useQuery<AvailableAsset[]>({
    queryKey: ["assets-available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, asset_code, asset_name")
        .eq("asset_status", "tersedia")
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: formOpen,
  });

  // Filter loans locally
  const filteredLoans = loans.filter((l) => {
    const code = l.assets?.asset_code?.toLowerCase() || "";
    const name = l.assets?.asset_name?.toLowerCase() || "";
    const borrower = l.borrower_name?.toLowerCase() || "";
    const query = search.toLowerCase();
    return code.includes(query) || name.includes(query) || borrower.includes(query);
  });

  const activeLoans = filteredLoans.filter((l) => l.status === "borrowed");
  const returnedLoans = filteredLoans.filter((l) => l.status === "returned");

  const createLoan = useMutation({
    mutationFn: async (payload: z.infer<typeof loanSchema>) => {
      const { data: auth } = await supabase.auth.getUser();

      // 1. Insert into asset_loans
      const { data: newLoan, error: loanError } = await supabase
        .from("asset_loans")
        .insert({
          asset_id: payload.asset_id,
          borrower_name: payload.borrower_name,
          borrower_unit: payload.borrower_unit || null,
          borrower_contact: payload.borrower_contact || null,
          loan_date: payload.loan_date,
          due_date: payload.due_date,
          purpose: payload.purpose || null,
          status: "borrowed",
          created_by: auth.user?.id || null,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // 2. Update asset_status to 'dipinjam'
      const { error: assetError } = await supabase
        .from("assets")
        .update({ asset_status: "dipinjam" })
        .eq("id", payload.asset_id);

      if (assetError) throw assetError;

      const assetObj = availableAssets.find((a) => a.id === payload.asset_id);

      // 3. Log Activity
      await logActivity({
        action: "LOAN",
        module: "assets",
        tableName: "asset_loans",
        recordId: newLoan.id,
        description: `Mencatat peminjaman aset ${assetObj?.asset_code} oleh ${payload.borrower_name}`,
      });
    },
    onSuccess: () => {
      toast.success("Peminjaman aset berhasil dicatat.");
      setFormOpen(false);

      // Reset Form
      setSelectedAssetId("");
      setBorrowerName("");
      setBorrowerUnit("");
      setBorrowerContact("");
      setLoanDate(new Date().toISOString().slice(0, 10));
      setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setPurpose("");

      queryClient.invalidateQueries({ queryKey: ["loans-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal mencatat peminjaman.");
    },
  });

  const handleReturnAsset = useMutation({
    mutationFn: async () => {
      if (!activeLoanId) return;

      // Fetch loan info
      const { data: loan, error: fetchError } = await supabase
        .from("asset_loans")
        .select("*, assets(asset_code, asset_name)")
        .eq("id", activeLoanId)
        .single();

      if (fetchError || !loan) throw new Error("Informasi peminjaman tidak ditemukan.");

      // 1. Update loan record
      const { error: loanError } = await supabase
        .from("asset_loans")
        .update({
          status: "returned",
          return_date: returnDate,
          return_condition: returnCondition,
        })
        .eq("id", activeLoanId);

      if (loanError) throw loanError;

      // 2. Update asset status and condition
      const { error: assetError } = await supabase
        .from("assets")
        .update({
          asset_status: "tersedia",
          condition_status: returnCondition,
        })
        .eq("id", loan.asset_id);

      if (assetError) throw assetError;

      // 3. Log Activity
      await logActivity({
        action: "RETURN",
        module: "assets",
        tableName: "asset_loans",
        recordId: activeLoanId,
        description: `Mencatat pengembalian aset ${loan.assets?.asset_code} dari ${loan.borrower_name}`,
      });
    },
    onSuccess: () => {
      toast.success("Pengembalian aset berhasil dicatat.");
      setReturnOpen(false);
      setActiveLoanId(null);
      setReturnDate(new Date().toISOString().slice(0, 10));
      setReturnCondition("baik");

      queryClient.invalidateQueries({ queryKey: ["loans-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memproses pengembalian.");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const parsed = loanSchema.safeParse({
      asset_id: selectedAssetId,
      borrower_name: borrowerName,
      borrower_unit: borrowerUnit,
      borrower_contact: borrowerContact,
      loan_date: loanDate,
      due_date: dueDate,
      purpose,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Isian form tidak valid");
      setSubmitLoading(false);
      return;
    }

    createLoan.mutate(parsed.data, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    handleReturnAsset.mutate(undefined, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const openReturnDialog = (loanId: string) => {
    setActiveLoanId(loanId);
    setReturnOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari peminjam atau nama aset..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {canEdit && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Catat Peminjaman
          </Button>
        )}
      </div>

      <Tabs defaultValue="aktif" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="aktif">Peminjaman Aktif ({activeLoans.length})</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Kembali ({returnedLoans.length})</TabsTrigger>
        </TabsList>

        {isPending ? (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-[var(--shadow-card)]">
            Gagal memuat daftar peminjaman. Silakan segarkan halaman.
          </div>
        ) : (
          <>
            <TabsContent value="aktif" className="mt-4 space-y-4">
              {activeLoans.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
                  <ClipboardList className="mx-auto size-12 text-muted-foreground/60 mb-3" />
                  <p className="font-semibold text-foreground">Tidak ada peminjaman aktif</p>
                  <p className="text-sm mt-1">
                    Seluruh aset yang dapat dipinjam berstatus tersedia.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aset</TableHead>
                        <TableHead>Peminjam / Pegawai</TableHead>
                        <TableHead>Tanggal Pinjam</TableHead>
                        <TableHead>Batas Pengembalian</TableHead>
                        {canEdit && <TableHead className="w-[120px] text-center">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeLoans.map((l) => {
                        const isOverdue = new Date(l.due_date) < new Date() && !l.return_date;
                        return (
                          <TableRow key={l.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-bold text-muted-foreground">
                                  {l.assets?.asset_code}
                                </p>
                                <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                                  {l.assets?.asset_name}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium text-foreground">{l.borrower_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {l.borrower_unit || "-"}{" "}
                                  {l.borrower_contact ? `| ${l.borrower_contact}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">
                              {formatDate(l.loan_date)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm flex flex-col items-start gap-1">
                                <span className="font-medium text-foreground">
                                  {formatDate(l.due_date)}
                                </span>
                                {isOverdue ? (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    Terlambat
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px] px-1.5 py-0">
                                    Dipinjam
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            {canEdit && (
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 text-xs font-semibold"
                                  onClick={() => openReturnDialog(l.id)}
                                >
                                  <Check className="size-3.5" /> Kembalikan
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="riwayat" className="mt-4 space-y-4">
              {returnedLoans.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
                  <ClipboardList className="mx-auto size-12 text-muted-foreground/60 mb-3" />
                  <p className="font-semibold text-foreground">Belum ada riwayat pengembalian</p>
                  <p className="text-sm mt-1">
                    Aset yang telah dipinjam dan dikembalikan akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aset</TableHead>
                        <TableHead>Peminjam</TableHead>
                        <TableHead>Durasi Pinjam</TableHead>
                        <TableHead>Pengembalian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnedLoans.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-muted-foreground">
                                {l.assets?.asset_code}
                              </p>
                              <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                                {l.assets?.asset_name}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-foreground">{l.borrower_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {l.borrower_unit || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            <div>
                              <p className="font-medium">{formatDate(l.loan_date)} s/d</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(l.due_date)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-success-foreground">
                                {formatDate(l.return_date)}
                              </p>
                              <div className="flex gap-1.5 items-center mt-0.5">
                                <Badge className="bg-success-soft text-success text-[10px] px-1.5 py-0">
                                  Kembali
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  Kondisi: {conditionLabel(l.return_condition)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Dialog Catat Peminjaman */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Catat Peminjaman Aset</DialogTitle>
              <DialogDescription>
                Hanya menampilkan daftar aset yang berstatus 'tersedia' untuk dipinjamkan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="asset_id">Pilih Aset Tersedia *</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger id="asset_id">
                    <SelectValue placeholder="Pilih Aset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.asset_code} - {a.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="borrower_name">Nama Peminjam / Pegawai *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="borrower_name"
                    placeholder="Masukkan nama lengkap peminjam"
                    className="pl-9"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="borrower_unit">Unit Kerja / Bidang</Label>
                  <Input
                    id="borrower_unit"
                    placeholder="Contoh: Bidang Informatika"
                    value={borrowerUnit}
                    onChange={(e) => setBorrowerUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="borrower_contact">No. Telp / Kontak</Label>
                  <Input
                    id="borrower_contact"
                    placeholder="Contoh: 081234..."
                    value={borrowerContact}
                    onChange={(e) => setBorrowerContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="loan_date">Tanggal Pinjam *</Label>
                  <Input
                    id="loan_date"
                    type="date"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due_date">Jatuh Tempo Kembali *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="purpose">Tujuan Peminjaman</Label>
                <Textarea
                  id="purpose"
                  placeholder="Masukkan tujuan peminjaman aset secara singkat..."
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  "Catat Pinjam"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Pengembalian */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleReturnSubmit}>
            <DialogHeader>
              <DialogTitle>Konfirmasi Pengembalian Aset</DialogTitle>
              <DialogDescription>
                Catat tanggal pengembalian dan kondisi fisik terakhir dari aset yang dipinjam.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="return_date">Tanggal Pengembalian *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="return_date"
                    type="date"
                    className="pl-9"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="return_condition">Kondisi Pengembalian *</Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger id="return_condition">
                    <SelectValue placeholder="Kondisi Aset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnOpen(false)}
                disabled={submitLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  "Proses Kembali"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
