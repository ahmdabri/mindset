import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Check, Printer, QrCode, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCategories, useLocations } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import { generateUUID } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/qr")({
  head: () => ({
    meta: [
      { title: "QR Code - MINDSET Diskominfo" },
      { name: "description", content: "Cetak label QR code untuk aset." },
      { property: "og:title", content: "QR Code - MINDSET Diskominfo" },
      { property: "og:description", content: "Generate, preview, dan cetak label QR aset." },
    ],
  }),
  component: Page,
});

interface AssetWithQr {
  id: string;
  asset_code: string;
  asset_name: string;
  category_id: number;
  location_id: number;
  categories: { name: string } | null;
  locations: { name: string; room: string | null } | null;
  asset_qr_codes: {
    id: string;
    qr_token: string;
    print_count: number;
    printed_at: string | null;
  } | null;
}

function Page() {
  return (
    <ModuleGuard module="qr">
      <div className="space-y-6">
        <PageHeader title="QR Code" description="Generate, preview, dan cetak label QR aset" />
        <QrView />
      </div>
    </ModuleGuard>
  );
}

function QrView() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);

  const {
    data: assets = [],
    isPending,
    isError,
  } = useQuery<AssetWithQr[]>({
    queryKey: ["assets-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          `
          id,
          asset_code,
          asset_name,
          category_id,
          location_id,
          categories(name),
          locations(name, room),
          asset_qr_codes(id, qr_token, print_count, printed_at)
        `,
        )
        .is("deleted_at", null);

      if (error) throw error;
      return (data || []) as unknown as AssetWithQr[];
    },
  });

  // Filter assets locally
  const filteredAssets = assets.filter((asset) => {
    const matchSearch =
      asset.asset_name.toLowerCase().includes(search.toLowerCase()) ||
      asset.asset_code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryId === "all" || asset.category_id === Number(categoryId);
    const matchLocation = locationId === "all" || asset.location_id === Number(locationId);
    return matchSearch && matchCategory && matchLocation;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAssets.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handlePrint = async () => {
    if (selectedIds.length === 0) {
      toast.warning("Silakan pilih minimal satu aset untuk dicetak.");
      return;
    }

    setPrinting(true);
    try {
      const now = new Date().toISOString();
      const targets = assets.filter((a) => selectedIds.includes(a.id));

      // Update print status in DB
      await Promise.all(
        targets.map(async (asset) => {
          if (asset.asset_qr_codes) {
            await supabase
              .from("asset_qr_codes")
              .update({
                printed_at: now,
                print_count: (asset.asset_qr_codes.print_count || 0) + 1,
              })
              .eq("id", asset.asset_qr_codes.id);
          } else {
            // Fallback: create qr token if missing
            const token = generateUUID().replace(/-/g, "");
            await supabase.from("asset_qr_codes").insert({
              asset_id: asset.id,
              qr_token: token,
              printed_at: now,
              print_count: 1,
            });
          }
        }),
      );

      await logActivity({
        action: "PRINT",
        module: "qr",
        tableName: "asset_qr_codes",
        description: `Mencetak ${targets.length} label QR Code aset`,
      });

      toast.success("Mempersiapkan halaman cetak...");

      // Wait for React to render/update before printing
      setTimeout(() => {
        window.print();
        setPrinting(false);
        queryClient.invalidateQueries({ queryKey: ["assets-qr"] });
      }, 500);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui status cetak.");
      setPrinting(false);
    }
  };

  // Get selected assets details for rendering print labels
  const assetsToPrint = assets.filter((a) => selectedIds.includes(a.id));

  return (
    <div className="space-y-6">
      {/* CSS untuk menyembunyikan semua kecuali area cetak saat window.print() dipanggil */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          /* Sembunyikan elemen utama web */
          body * {
            visibility: hidden;
          }
          /* Tampilkan area cetak */
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          /* Hindari break page di tengah label */
          .label-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `,
        }}
      />

      {/* Area yang akan dicetak */}
      <div id="print-area" className="hidden print:block print:w-full">
        <div className="grid grid-cols-2 gap-4 p-2">
          {assetsToPrint.map((asset) => {
            const qrValue = `${window.location.origin}/scan/${asset.asset_qr_codes?.qr_token || asset.id}`;
            return (
              <div
                key={asset.id}
                className="label-card flex h-[4cm] w-[8.5cm] items-center justify-between border border-dashed border-gray-400 bg-white p-3 rounded-md text-black"
                style={{ contentVisibility: "auto" }}
              >
                <div className="flex flex-col justify-between h-full w-[60%] select-none">
                  <div>
                    <p className="text-[10px] font-extrabold tracking-wider text-blue-800 leading-none">
                      DISKOMINFO BONDOWOSO
                    </p>
                    <p className="text-[8px] font-semibold text-gray-500 mt-0.5 leading-none">
                      Aplikasi MINDSET
                    </p>
                  </div>
                  <div className="my-1">
                    <p className="font-mono text-xs font-bold tracking-tight text-gray-900 leading-tight">
                      {asset.asset_code}
                    </p>
                    <p className="text-[11px] font-bold text-gray-800 line-clamp-2 leading-tight mt-0.5">
                      {asset.asset_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium text-gray-600 truncate leading-none">
                      Lokasi: {asset.locations?.name || "-"}
                    </p>
                    {asset.locations?.room && (
                      <p className="text-[8px] text-gray-500 truncate leading-none mt-0.5">
                        Ruang: {asset.locations.room}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center w-[35%] h-full pl-2 border-l border-gray-200">
                  <div className="bg-white p-1 rounded border border-gray-200">
                    <QRCodeSVG value={qrValue} size={80} level="M" includeMargin={false} />
                  </div>
                  <p className="text-[7px] text-gray-400 mt-1 font-mono tracking-tighter">
                    {asset.asset_qr_codes?.qr_token.slice(0, 8) || "NO-TOKEN"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tampilan filter & list data aset */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode atau nama aset..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full max-w-[180px]">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full max-w-[180px]">
              <SelectValue placeholder="Semua Lokasi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Lokasi</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                  {l.room ? ` - ${l.room}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handlePrint} disabled={selectedIds.length === 0 || printing}>
          <Printer className="size-4" />
          {printing ? "Mempersiapkan..." : `Cetak Label (${selectedIds.length})`}
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground shadow-[var(--shadow-card)]">
          Gagal memuat data aset. Silakan segarkan halaman.
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
          <QrCode className="mx-auto size-12 text-muted-foreground/60 mb-3" />
          <p className="font-semibold text-foreground">Tidak ada aset ditemukan</p>
          <p className="text-sm mt-1">Coba sesuaikan kata kunci pencarian atau filter Anda.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <Checkbox
                    checked={
                      filteredAssets.length > 0 &&
                      filteredAssets.every((a) => selectedIds.includes(a.id))
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Aset</TableHead>
                <TableHead>Kategori / Lokasi</TableHead>
                <TableHead className="w-[120px] text-center">Preview QR</TableHead>
                <TableHead className="w-[180px] text-center">Riwayat Cetak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const qrValue = `${window.location.origin}/assets/${asset.id}`;
                const isSelected = selectedIds.includes(asset.id);
                return (
                  <TableRow key={asset.id} className={isSelected ? "bg-accent/40" : ""}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(asset.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-muted-foreground">
                          {asset.asset_code}
                        </p>
                        <p className="font-semibold text-foreground truncate max-w-sm mt-0.5">
                          {asset.asset_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-foreground">{asset.categories?.name || "-"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {asset.locations?.name || "-"}{" "}
                          {asset.locations?.room ? `| ${asset.locations.room}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center justify-center">
                        <div className="bg-white p-1 rounded border border-border shadow-sm">
                          <QRCodeSVG value={qrValue} size={44} level="M" includeMargin={false} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {asset.asset_qr_codes?.print_count || 0}x dicetak
                      </p>
                      <p className="text-xs mt-0.5">
                        {asset.asset_qr_codes?.printed_at
                          ? formatDate(asset.asset_qr_codes.printed_at)
                          : "Belum pernah"}
                      </p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
