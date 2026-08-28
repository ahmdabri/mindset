import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ArrowRight, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLocations, useMutationsList } from "@/hooks/useAssets";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canWriteAssets } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/mutations")({
  head: () => ({
    meta: [
      { title: "Mutasi Aset - MINDSET Diskominfo" },
      { name: "description", content: "Riwayat dan pencatatan perpindahan lokasi aset." },
      { property: "og:title", content: "Mutasi Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Riwayat dan pencatatan perpindahan lokasi aset." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="mutations">
      <div className="space-y-6">
        <PageHeader
          title="Mutasi Aset"
          description="Riwayat dan pencatatan perpindahan lokasi aset"
        />
        <MutationsView />
      </div>
    </ModuleGuard>
  );
}

const mutationSchema = z.object({
  asset_id: z.string().min(1, "Aset wajib dipilih"),
  to_location_id: z.string().min(1, "Lokasi tujuan wajib dipilih"),
  reason: z.string().trim().max(1000).optional(),
  document_number: z.string().trim().max(100).optional(),
  mutation_date: z.string().min(1, "Tanggal mutasi wajib diisi"),
});

interface AssetOption {
  id: string;
  asset_code: string;
  asset_name: string;
  location_id: number | null;
  locations: {
    name: string;
    room: string | null;
  } | null;
}

function MutationsView() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canEdit = canWriteAssets(currentUser?.role);

  const { data: mutations = [], isPending, isError } = useMutationsList();
  const { data: locations = [] } = useLocations();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form State
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [mutationDate, setMutationDate] = useState(new Date().toISOString().slice(0, 10));

  // Query assets options for selection
  const { data: assetOptions = [] } = useQuery<AssetOption[]>({
    queryKey: ["assets-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, asset_code, asset_name, location_id, locations(name, room)")
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []) as unknown as AssetOption[];
    },
    enabled: formOpen,
  });

  const selectedAsset = assetOptions.find((a) => a.id === selectedAssetId);
  const currentLocName = selectedAsset?.locations
    ? `${selectedAsset.locations.name} ${selectedAsset.locations.room ? `| ${selectedAsset.locations.room}` : ""}`
    : "Tidak diketahui / belum diatur";

  // Mutations filtered locally
  const filteredMutations = mutations.filter((m) => {
    const code = m.assets?.asset_code?.toLowerCase() || "";
    const name = m.assets?.asset_name?.toLowerCase() || "";
    const query = search.toLowerCase();
    return code.includes(query) || name.includes(query);
  });

  const createMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof mutationSchema>) => {
      const { data: auth } = await supabase.auth.getUser();

      // Get current location of asset as from_location_id
      const assetObj = assetOptions.find((a) => a.id === payload.asset_id);
      const fromLocationId = assetObj?.location_id || null;

      if (fromLocationId && String(fromLocationId) === payload.to_location_id) {
        throw new Error("Lokasi tujuan tidak boleh sama dengan lokasi saat ini.");
      }

      // 1. Insert into asset_mutations
      const { data: newMut, error: mutError } = await supabase
        .from("asset_mutations")
        .insert({
          asset_id: payload.asset_id,
          from_location_id: fromLocationId,
          to_location_id: Number(payload.to_location_id),
          mutation_date: payload.mutation_date,
          reason: payload.reason || null,
          document_number: payload.document_number || null,
          created_by: auth.user?.id || null,
        })
        .select()
        .single();

      if (mutError) throw mutError;

      // 2. Update location_id of the asset
      const { error: assetError } = await supabase
        .from("assets")
        .update({ location_id: Number(payload.to_location_id) })
        .eq("id", payload.asset_id);

      if (assetError) throw assetError;

      // 3. Log Activity
      await logActivity({
        action: "MUTATE",
        module: "assets",
        tableName: "asset_mutations",
        recordId: newMut.id,
        description: `Memutasi lokasi aset ${assetObj?.asset_code} ke ${
          locations.find((l) => l.id === Number(payload.to_location_id))?.name || "lokasi baru"
        }`,
      });
    },
    onSuccess: () => {
      toast.success("Mutasi aset berhasil dicatat.");
      setFormOpen(false);
      // Reset form
      setSelectedAssetId("");
      setToLocationId("");
      setReason("");
      setDocNumber("");
      setMutationDate(new Date().toISOString().slice(0, 10));

      queryClient.invalidateQueries({ queryKey: ["mutations-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-count"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal mencatat mutasi.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const parsed = mutationSchema.safeParse({
      asset_id: selectedAssetId,
      to_location_id: toLocationId,
      reason,
      document_number: docNumber,
      mutation_date: mutationDate,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Isian form tidak valid");
      setSubmitLoading(false);
      return;
    }

    createMutation.mutate(parsed.data, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama aset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        {canMutate && (
          <Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">
            <Plus className="size-4" /> Catat Mutasi Baru
          </Button>
        )}
      </div>

      {/* Table Section */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        {isPending ? (
          <div className="p-6 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-muted-foreground">
            Gagal memuat riwayat mutasi. Silakan segarkan halaman.
          </div>
        ) : filteredMutations.length === 0 ? (
          <div className="p-12 text-center">
            <MoveRight className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Belum ada riwayat mutasi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Semua perpindahan lokasi aset akan tercatat secara historis di halaman ini.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aset</TableHead>
                <TableHead>Alur Perpindahan</TableHead>
                <TableHead>Tanggal Mutasi</TableHead>
                <TableHead>Alasan / No. Dokumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMutations.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-muted-foreground">
                        {m.assets?.asset_code}
                      </p>
                      <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                        {m.assets?.asset_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-[150px]">
                          {m.from_location?.name || "-"}
                        </p>
                        {m.from_location?.room && (
                          <p className="text-xs text-muted-foreground truncate max-w-[150px] mt-0.5">
                            {m.from_location.room}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-blue-600 truncate max-w-[150px]">
                          {m.to_location?.name || "-"}
                        </p>
                        {m.to_location?.room && (
                          <p className="text-xs text-blue-500/80 truncate max-w-[150px] mt-0.5">
                            {m.to_location.room}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">
                    {formatDate(m.mutation_date)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm max-w-sm">
                      <p className="text-foreground line-clamp-1">{m.reason || "-"}</p>
                      {m.document_number && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Doc: {m.document_number}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Form Mutasi */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Catat Mutasi Lokasi Aset</DialogTitle>
              <DialogDescription>
                Pindahkan aset dari lokasi asal ke lokasi baru dan sinkronisasikan secara instan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="asset">Pilih Aset *</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger id="asset">
                    <SelectValue placeholder="Pilih Aset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.asset_code} - {a.asset_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAssetId && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-muted-foreground text-xs leading-none">Lokasi Saat Ini</p>
                  <p className="font-semibold text-foreground mt-1.5 leading-none">
                    {currentLocName}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="to_location">Lokasi Tujuan *</Label>
                <Select value={toLocationId} onValueChange={setToLocationId}>
                  <SelectTrigger id="to_location">
                    <SelectValue placeholder="Pilih Lokasi Tujuan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name} {l.room ? `| ${l.room}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mutation_date">Tanggal Mutasi *</Label>
                  <Input
                    id="mutation_date"
                    type="date"
                    value={mutationDate}
                    onChange={(e) => setMutationDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc_number">No. Surat / Dokumen</Label>
                  <Input
                    id="doc_number"
                    placeholder="Contoh: SPK/12/2026"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Alasan Pemindahan</Label>
                <Textarea
                  id="reason"
                  placeholder="Isi alasan mutasi atau catatan tambahan..."
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
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
                  "Simpan Mutasi"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
