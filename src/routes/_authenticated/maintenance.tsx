import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Calendar,
  Wrench,
  DollarSign,
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
import { useMaintenanceList } from "@/hooks/useAssets";
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
import { formatDate, formatRupiah } from "@/lib/format";
import { CONDITION_OPTIONS, conditionLabel } from "@/lib/asset-options";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance - MINDSET Diskominfo" },
      { name: "description", content: "Pemeliharaan dan perbaikan aset." },
      { property: "og:title", content: "Maintenance - MINDSET Diskominfo" },
      { property: "og:description", content: "Pemeliharaan dan perbaikan aset." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="maintenance">
      <div className="space-y-6">
        <PageHeader title="Maintenance" description="Pemeliharaan dan perbaikan aset" />
        <MaintenanceView />
      </div>
    </ModuleGuard>
  );
}

const maintSchema = z.object({
  asset_id: z.string().min(1, "Aset wajib dipilih"),
  maintenance_date: z.string().min(1, "Tanggal perawatan wajib diisi"),
  maintenance_type: z.string().min(1, "Jenis perawatan wajib dipilih"),
  vendor_name: z.string().trim().max(150).optional(),
  cost: z.coerce.number().min(0, "Biaya tidak boleh negatif"),
  description: z.string().trim().max(1000).optional(),
  status: z.string().min(1),
});

interface AssetOption {
  id: string;
  asset_code: string;
  asset_name: string;
}

function MaintenanceView() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canEdit = canWriteAssets(currentUser?.role);

  const { data: records = [], isPending, isError } = useMaintenanceList();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form State
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [maintDate, setMaintDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintType, setMaintType] = useState("Pemeliharaan Rutin");
  const [vendorName, setVendorName] = useState("");
  const [cost, setCost] = useState("0");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("in_progress");

  // Complete Form State
  const [activeMaintId, setActiveMaintId] = useState<string | null>(null);
  const [finishDate, setFinishDate] = useState(new Date().toISOString().slice(0, 10));
  const [actualCost, setActualCost] = useState("0");
  const [conditionAfter, setConditionAfter] = useState("baik");
  const [completeNotes, setCompleteNotes] = useState("");

  // Query all active assets for selection
  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ["assets-options-maint"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, asset_code, asset_name")
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: formOpen,
  });

  // Filter maintenance records locally
  const filteredRecords = records.filter((r) => {
    const code = r.assets?.asset_code?.toLowerCase() || "";
    const name = r.assets?.asset_name?.toLowerCase() || "";
    const vendor = r.vendor_name?.toLowerCase() || "";
    const query = search.toLowerCase();
    return code.includes(query) || name.includes(query) || vendor.includes(query);
  });

  const activeRecords = filteredRecords.filter((r) => r.status !== "completed");
  const completedRecords = filteredRecords.filter((r) => r.status === "completed");

  const createMaintenance = useMutation({
    mutationFn: async (payload: z.infer<typeof maintSchema>) => {
      const { data: auth } = await supabase.auth.getUser();

      // 1. Insert into maintenance_records
      const { data: newRec, error: maintError } = await supabase
        .from("maintenance_records")
        .insert({
          asset_id: payload.asset_id,
          maintenance_date: payload.maintenance_date,
          maintenance_type: payload.maintenance_type,
          vendor_name: payload.vendor_name || null,
          cost: payload.cost,
          description: payload.description || null,
          status: payload.status,
          start_date: payload.status === "in_progress" ? payload.maintenance_date : null,
          created_by: auth.user?.id || null,
        })
        .select()
        .single();

      if (maintError) throw maintError;

      const assetObj = assets.find((a) => a.id === payload.asset_id);

      // 2. If status is in_progress, update asset_status to 'perbaikan'
      if (payload.status === "in_progress") {
        const { error: assetError } = await supabase
          .from("assets")
          .update({ asset_status: "perbaikan" })
          .eq("id", payload.asset_id);
        if (assetError) throw assetError;
      }

      // 3. Log Activity
      await logActivity({
        action: "MAINTAIN",
        module: "assets",
        tableName: "maintenance_records",
        recordId: newRec.id,
        description: `Mencatat agenda pemeliharaan (${payload.maintenance_type}) aset ${assetObj?.asset_code}`,
      });
    },
    onSuccess: () => {
      toast.success("Catatan pemeliharaan berhasil ditambahkan.");
      setFormOpen(false);

      // Reset Form
      setSelectedAssetId("");
      setMaintDate(new Date().toISOString().slice(0, 10));
      setMaintType("Pemeliharaan Rutin");
      setVendorName("");
      setCost("0");
      setDescription("");
      setStatus("in_progress");

      queryClient.invalidateQueries({ queryKey: ["maintenance-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal mencatat pemeliharaan.");
    },
  });

  const handleCompleteMaint = useMutation({
    mutationFn: async () => {
      if (!activeMaintId) return;

      const { data: record, error: fetchError } = await supabase
        .from("maintenance_records")
        .select("*, assets(asset_code)")
        .eq("id", activeMaintId)
        .single();

      if (fetchError || !record) throw new Error("Data pemeliharaan tidak ditemukan.");

      const now = new Date().toISOString();

      // 1. Update maintenance record
      const { error: maintError } = await supabase
        .from("maintenance_records")
        .update({
          status: "completed",
          finish_date: finishDate,
          cost: Number(actualCost),
          condition_after: conditionAfter,
          description: completeNotes || record.description,
        })
        .eq("id", activeMaintId);

      if (maintError) throw maintError;

      // 2. Set asset status back to 'tersedia' and update condition
      const { error: assetError } = await supabase
        .from("assets")
        .update({
          asset_status: "tersedia",
          condition_status: conditionAfter,
        })
        .eq("id", record.asset_id);

      if (assetError) throw assetError;

      // 3. Log Activity
      await logActivity({
        action: "MAINTAIN",
        module: "assets",
        tableName: "maintenance_records",
        recordId: activeMaintId,
        description: `Menyelesaikan perawatan aset ${record.assets?.asset_code} dengan kondisi: ${conditionAfter}`,
      });
    },
    onSuccess: () => {
      toast.success("Pemeliharaan diselesaikan.");
      setCompleteOpen(false);
      setActiveMaintId(null);
      setFinishDate(new Date().toISOString().slice(0, 10));
      setActualCost("0");
      setConditionAfter("baik");
      setCompleteNotes("");

      queryClient.invalidateQueries({ queryKey: ["maintenance-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal memproses penyelesaian.");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const parsed = maintSchema.safeParse({
      asset_id: selectedAssetId,
      maintenance_date: maintDate,
      maintenance_type: maintType,
      vendor_name: vendorName,
      cost,
      description,
      status,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Isian form tidak valid");
      setSubmitLoading(false);
      return;
    }

    createMaintenance.mutate(parsed.data, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    handleCompleteMaint.mutate(undefined, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const openCompleteDialog = (id: string, estCost: number) => {
    setActiveMaintId(id);
    setActualCost(String(estCost));
    setCompleteOpen(true);
  };

  const maintTypeBadge = (type: string) => {
    const isRepair = type.toLowerCase().includes("perbaikan");
    return (
      <Badge
        variant="outline"
        className={
          isRepair
            ? "bg-red-500/10 text-red-600 border-red-500/20"
            : "bg-blue-500/10 text-blue-600 border-blue-500/20"
        }
      >
        {type}
      </Badge>
    );
  };

  const maintStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          >
            Dijadwalkan
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="outline"
            className="bg-orange-500/10 text-orange-600 border-orange-500/20"
          >
            Dikerjakan
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-success-soft text-success border-success-soft text-[10px] px-1.5 py-0">
            Selesai
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari vendor atau nama aset..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {canEdit && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Tambah Perawatan
          </Button>
        )}
      </div>

      <Tabs defaultValue="aktif" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="aktif">Perawatan Aktif ({activeRecords.length})</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Selesai ({completedRecords.length})</TabsTrigger>
        </TabsList>

        {isPending ? (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-[var(--shadow-card)]">
            Gagal memuat daftar pemeliharaan. Silakan segarkan halaman.
          </div>
        ) : (
          <>
            <TabsContent value="aktif" className="mt-4 space-y-4">
              {activeRecords.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
                  <ClipboardList className="mx-auto size-12 text-muted-foreground/60 mb-3" />
                  <p className="font-semibold text-foreground">Tidak ada perawatan aktif</p>
                  <p className="text-sm mt-1">
                    Seluruh aset dalam kondisi baik dan tidak ada pemeliharaan berjalan.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aset</TableHead>
                        <TableHead>Pemeliharaan</TableHead>
                        <TableHead>Teknisi / Vendor</TableHead>
                        <TableHead>Tanggal / Estimasi Biaya</TableHead>
                        <TableHead>Status</TableHead>
                        {canEdit && <TableHead className="w-[120px] text-center">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-muted-foreground">
                                {r.assets?.asset_code}
                              </p>
                              <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                                {r.assets?.asset_name}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {maintTypeBadge(r.maintenance_type)}
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                {r.description || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground">
                            {r.vendor_name || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-foreground">
                                {formatDate(r.maintenance_date)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatRupiah(r.cost)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{maintStatusBadge(r.status)}</TableCell>
                          {canEdit && (
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs font-semibold"
                                onClick={() => openCompleteDialog(r.id, Number(r.cost))}
                              >
                                <Check className="size-3.5" /> Selesaikan
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="riwayat" className="mt-4 space-y-4">
              {completedRecords.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
                  <ClipboardList className="mx-auto size-12 text-muted-foreground/60 mb-3" />
                  <p className="font-semibold text-foreground">
                    Belum ada riwayat perawatan selesai
                  </p>
                  <p className="text-sm mt-1">
                    Riwayat pengerjaan pemeliharaan akan terekam di sini.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aset</TableHead>
                        <TableHead>Pemeliharaan</TableHead>
                        <TableHead>Teknisi / Vendor</TableHead>
                        <TableHead>Durasi Pengerjaan</TableHead>
                        <TableHead>Biaya Riil</TableHead>
                        <TableHead>Kondisi Akhir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-muted-foreground">
                                {r.assets?.asset_code}
                              </p>
                              <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                                {r.assets?.asset_name}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {maintTypeBadge(r.maintenance_type)}
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                {r.description || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground">
                            {r.vendor_name || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            <div>
                              <p className="font-medium">{formatDate(r.maintenance_date)} s/d</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {r.finish_date ? formatDate(r.finish_date) : "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-foreground">
                            {formatRupiah(r.cost)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {maintStatusBadge(r.status)}
                              <p className="text-xs text-muted-foreground font-semibold leading-none mt-1">
                                {conditionLabel(r.condition_after)}
                              </p>
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

      {/* Dialog Catat Pemeliharaan */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Catat Jadwal Pemeliharaan</DialogTitle>
              <DialogDescription>
                Daftarkan rencana pemeliharaan rutin atau perbaikan untuk aset.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="asset_id">Pilih Aset *</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger id="asset_id">
                    <SelectValue placeholder="Pilih Aset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.asset_code} - {a.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maint_type">Jenis Pemeliharaan *</Label>
                <Select value={maintType} onValueChange={setMaintType}>
                  <SelectTrigger id="maint_type">
                    <SelectValue placeholder="Pilih Jenis..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pemeliharaan Rutin">Pemeliharaan Rutin</SelectItem>
                    <SelectItem value="Perbaikan Kerusakan">Perbaikan Kerusakan</SelectItem>
                    <SelectItem value="Kalibrasi Alat">Kalibrasi / Pembaruan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vendor_name">Vendor / Teknisi</Label>
                <div className="relative">
                  <Wrench className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="vendor_name"
                    placeholder="Contoh: CV. Komputer Jaya"
                    className="pl-9"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maint_date">Tanggal Mulai *</Label>
                  <Input
                    id="maint_date"
                    type="date"
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cost">Estimasi Biaya (Rp)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="cost"
                      type="number"
                      placeholder="0"
                      className="pl-9"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status Awal *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Pilih Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Dijadwalkan</SelectItem>
                    <SelectItem value="in_progress">Dikerjakan (Status Aset: Perbaikan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi Kendala</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsikan kerusakan atau jenis pekerjaan perawatan secara detail..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  "Catat Perawatan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Selesaikan Pemeliharaan */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCompleteSubmit}>
            <DialogHeader>
              <DialogTitle>Selesaikan Pemeliharaan Aset</DialogTitle>
              <DialogDescription>
                Catat tanggal selesai, biaya akhir, dan kondisi aset pasca-perawatan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="finish_date">Tanggal Selesai *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="finish_date"
                    type="date"
                    className="pl-9"
                    value={finishDate}
                    onChange={(e) => setFinishDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="actual_cost">Biaya Riil (Rp) *</Label>
                  <Input
                    id="actual_cost"
                    type="number"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="condition_after">Kondisi Aset Akhir *</Label>
                  <Select value={conditionAfter} onValueChange={setConditionAfter}>
                    <SelectTrigger id="condition_after">
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

              <div className="space-y-1.5">
                <Label htmlFor="complete_notes">Catatan Perbaikan</Label>
                <Textarea
                  id="complete_notes"
                  placeholder="Tambahkan catatan perbaikan atau rincian sparepart yang diganti..."
                  rows={3}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCompleteOpen(false)}
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
                  "Selesaikan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
