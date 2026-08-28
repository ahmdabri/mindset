import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Search, FileSpreadsheet, FileText, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLocations, useCategories } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate, formatRupiah } from "@/lib/format";
import {
  CONDITION_OPTIONS,
  STATUS_OPTIONS,
  conditionLabel,
  statusLabel,
} from "@/lib/asset-options";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Laporan Aset - MINDSET Diskominfo" },
      { name: "description", content: "Laporan aset, transaksi, dan nilai aset." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="reports">
      <div className="space-y-6">
        <PageHeader
          title="Laporan Aset"
          description="Saring data, pratinjau laporan dinas, dan ekspor ke PDF atau Excel"
        />
        <ReportsView />
      </div>
    </ModuleGuard>
  );
}

interface ReportAssetRow {
  id: string;
  asset_code: string;
  asset_name: string;
  acquisition_date: string;
  acquisition_price: number;
  condition_status: string;
  asset_status: string;
  category_id: number;
  location_id: number;
  locations: { name: string; room: string | null } | null;
  categories: { name: string } | null;
}

function ReportsView() {
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedLoc, setSelectedLoc] = useState("all");
  const [selectedCat, setSelectedCat] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState("all");

  // Query assets with filter params
  const {
    data: assets = [],
    isPending,
    isError,
  } = useQuery<ReportAssetRow[]>({
    queryKey: ["report-assets", selectedLoc, selectedCat, selectedStatus, selectedCondition],
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select("*, locations(name, room), categories(name)")
        .is("deleted_at", null);

      if (selectedLoc !== "all") {
        query = query.eq("location_id", Number(selectedLoc));
      }
      if (selectedCat !== "all") {
        query = query.eq("category_id", Number(selectedCat));
      }
      if (selectedStatus !== "all") {
        query = query.eq("asset_status", selectedStatus);
      }
      if (selectedCondition !== "all") {
        query = query.eq("condition_status", selectedCondition);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ReportAssetRow[];
    },
  });

  // Client side search filter
  const filteredAssets = assets.filter((a) => {
    const code = a.asset_code.toLowerCase();
    const name = a.asset_name.toLowerCase();
    const query = search.toLowerCase();
    return code.includes(query) || name.includes(query);
  });

  // Calculate Metrics
  const totalCount = filteredAssets.length;
  const totalValue = filteredAssets.reduce((sum, item) => sum + Number(item.acquisition_price), 0);
  const goodCount = filteredAssets.filter((a) => a.condition_status === "baik").length;
  const damagedCount = filteredAssets.filter((a) => a.condition_status !== "baik").length;

  const handlePrint = () => {
    const prevTitle = document.title;
    // Kosongkan title browser sementara agar tidak muncul di header atas kertas cetak
    document.title = "";
    toast.success("Mempersiapkan dokumen cetak...");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = prevTitle || "Laporan Aset - MINDSET Diskominfo";
      }, 500);
    }, 300);
  };

  const handleExportCSV = () => {
    if (filteredAssets.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }

    try {
      const headers = [
        "Kode Aset",
        "Nama Aset",
        "Kategori",
        "Lokasi",
        "Tanggal Perolehan",
        "Harga Perolehan",
        "Kondisi",
        "Status",
      ];
      const rows = filteredAssets.map((a) => [
        a.asset_code,
        a.asset_name,
        a.categories?.name || "-",
        a.locations
          ? `${a.locations.name}${a.locations.room ? ` (${a.locations.room})` : ""}`
          : "-",
        a.acquisition_date,
        a.acquisition_price,
        conditionLabel(a.condition_status),
        statusLabel(a.asset_status),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      // Add UTF-8 BOM so Excel opens it with correct characters
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Laporan_Aset_SIMAKO_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("File Excel (CSV) berhasil diunduh.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengekspor laporan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Stylesheet khusus untuk print layout surat dinas A4 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          
          /* Reset background and text colors */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Sembunyikan semua elemen web biasa */
          body * {
            visibility: hidden;
          }

          /* Tampilkan area dokumen cetak */
          #print-document, #print-document * {
            visibility: visible;
          }

          #print-document {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif;
          }

          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 10px;
            margin-bottom: 12px;
            page-break-inside: auto;
          }

          .print-table th, 
          .print-table td {
            border: 1px solid #333333 !important;
            padding: 5px 6px !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
            color: #000000 !important;
          }

          .print-table th {
            background-color: #f1f3f5 !important;
            font-weight: bold !important;
            text-align: center !important;
          }

          .print-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .print-table thead {
            display: table-header-group;
          }

          .print-table tfoot {
            display: table-footer-group;
          }

          .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `,
        }}
      />

      {/* PANEL METRIK EMPAT KOLOM */}
      <div className="grid gap-4 md:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs text-muted-foreground font-semibold">Total Kuantitas Aset</p>
          <p className="mt-2 text-2xl font-black text-foreground">{totalCount} Unit</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs text-muted-foreground font-semibold">Total Nilai Investasi</p>
          <p className="mt-2 text-2xl font-black text-blue-600">{formatRupiah(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs text-muted-foreground font-semibold">Aset Kondisi Baik</p>
          <p className="mt-2 text-2xl font-black text-success">{goodCount} Unit</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs text-muted-foreground font-semibold">Aset Rusak / Perbaikan</p>
          <p className="mt-2 text-2xl font-black text-destructive">{damagedCount} Unit</p>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4 print:hidden">
        <h3 className="text-sm font-bold text-foreground">Saring Kriteria Laporan</h3>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="search">Cari Nama/Kode</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Cari kode atau nama aset..."
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Lokasi</Label>
            <Select value={selectedLoc} onValueChange={setSelectedLoc}>
              <SelectTrigger id="location" className="h-9">
                <SelectValue placeholder="Semua Lokasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lokasi</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name} {l.room ? `(${l.room})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Kategori</Label>
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger id="category" className="h-9">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="status" className="h-9">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="condition">Kondisi</Label>
            <Select value={selectedCondition} onValueChange={setSelectedCondition}>
              <SelectTrigger id="condition" className="h-9">
                <SelectValue placeholder="Semua Kondisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kondisi</SelectItem>
                {CONDITION_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" className="h-9" onClick={handleExportCSV}>
            <FileSpreadsheet className="size-4" /> Ekspor Excel
          </Button>
          <Button className="h-9" onClick={handlePrint}>
            <Printer className="size-4" /> Cetak / Unduh PDF
          </Button>
        </div>
      </div>

      {/* TABLE PRATINJAU DATA LAYAR */}
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden print:hidden">
        {isPending ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-muted-foreground">
            Gagal memuat pratinjau laporan.
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Tidak ada aset yang sesuai kriteria filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Kode Aset</TableHead>
                  <TableHead>Nama Aset</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Tgl Perolehan</TableHead>
                  <TableHead className="text-right">Harga Perolehan</TableHead>
                  <TableHead className="text-center">Kondisi</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((a, idx) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">
                      {a.asset_code}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{a.asset_name}</TableCell>
                    <TableCell>{a.categories?.name || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {a.locations
                        ? `${a.locations.name}${a.locations.room ? ` | ${a.locations.room}` : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>{formatDate(a.acquisition_date)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(a.acquisition_price)}
                    </TableCell>
                    <TableCell className="text-center capitalize text-xs font-semibold">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-muted">
                        {conditionLabel(a.condition_status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center capitalize text-xs font-semibold">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium border bg-muted">
                        {statusLabel(a.asset_status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* DOKUMEN CETAK RESMI SURAT DINAS (HANYA MUNCUL SAAT PRINT / CETAK PDF) */}
      <div id="print-document" className="hidden print:block print:w-full">
        {/* Kop Surat Resmi Kedinasan */}
        <div className="text-center pb-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-black leading-tight">
            PEMERINTAH KABUPATEN BONDOWOSO
          </p>
          <p className="text-sm font-black uppercase tracking-wide text-black leading-tight mt-0.5">
            DINAS KOMUNIKASI DAN INFORMATIKA
          </p>
          <p className="text-[8pt] text-gray-700 leading-tight mt-1">
            Jl. Letnan Karsono No. 1, Bondowoso, Jawa Timur 68212 | Telp/Fax: (0332) 421000
          </p>
          <p className="text-[7.5pt] text-gray-600 leading-tight">
            Email: diskominfo@bondowosokab.go.id | Website: diskominfo.bondowosokab.go.id
          </p>
          <div className="border-b-[2.5px] border-double border-black mt-2 pt-0.5"></div>
        </div>

        {/* Judul Laporan */}
        <div className="text-center mb-3">
          <p className="text-xs font-bold uppercase underline tracking-wider text-black">
            LAPORAN REKAPITULASI INVENTARIS DATA ASET
          </p>
          <p className="text-[7.5pt] text-gray-600 mt-0.5">
            Tanggal Cetak: {formatDate(new Date().toISOString())}
          </p>
        </div>

        {/* Ringkasan Filter & Metrik Cetak */}
        <div className="border border-gray-400 rounded p-2 mb-3 bg-gray-50/50 text-[8pt]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-600">Lokasi:</span>
              <span className="font-semibold text-black">
                {selectedLoc === "all"
                  ? "Semua Lokasi"
                  : locations.find((l) => l.id === Number(selectedLoc))?.name || "-"}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-600">Kategori:</span>
              <span className="font-semibold text-black">
                {selectedCat === "all"
                  ? "Semua Kategori"
                  : categories.find((c) => c.id === Number(selectedCat))?.name || "-"}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold text-black">
                {selectedStatus === "all" ? "Semua Status" : statusLabel(selectedStatus)}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-0.5">
              <span className="text-gray-600">Kondisi:</span>
              <span className="font-semibold text-black">
                {selectedCondition === "all" ? "Semua Kondisi" : conditionLabel(selectedCondition)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2 pt-1.5 border-t border-gray-300 text-center font-semibold">
            <div className="bg-white p-1 rounded border border-gray-200">
              <div className="text-[7pt] text-gray-500 font-normal">Total Aset</div>
              <div className="text-black">{totalCount} Unit</div>
            </div>
            <div className="bg-white p-1 rounded border border-gray-200">
              <div className="text-[7pt] text-gray-500 font-normal">Kondisi Baik</div>
              <div className="text-black">{goodCount} Unit</div>
            </div>
            <div className="bg-white p-1 rounded border border-gray-200">
              <div className="text-[7pt] text-gray-500 font-normal">Rusak/Perbaikan</div>
              <div className="text-black">{damagedCount} Unit</div>
            </div>
            <div className="bg-white p-1 rounded border border-gray-200">
              <div className="text-[7pt] text-gray-500 font-normal">Total Nilai Investasi</div>
              <div className="text-black">{formatRupiah(totalValue)}</div>
            </div>
          </div>
        </div>

        {/* Tabel Data Aset Resmi untuk Cetak */}
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "28px" }}>No</th>
              <th style={{ width: "85px" }}>Kode Aset</th>
              <th>Nama Aset</th>
              <th style={{ width: "80px" }}>Kategori</th>
              <th style={{ width: "95px" }}>Lokasi</th>
              <th style={{ width: "70px" }}>Tgl Perolehan</th>
              <th style={{ width: "70px" }}>Kondisi</th>
              <th style={{ width: "65px" }}>Status</th>
              <th style={{ width: "90px" }}>Nilai Perolehan</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-500 italic">
                  Tidak ada aset yang sesuai kriteria filter.
                </td>
              </tr>
            ) : (
              filteredAssets.map((a, index) => (
                <tr key={a.id}>
                  <td className="text-center">{index + 1}</td>
                  <td className="font-mono text-center font-medium">{a.asset_code}</td>
                  <td className="font-medium">{a.asset_name}</td>
                  <td>{a.categories?.name || "-"}</td>
                  <td>
                    {a.locations
                      ? `${a.locations.name}${a.locations.room ? ` - ${a.locations.room}` : ""}`
                      : "-"}
                  </td>
                  <td className="text-center">{formatDate(a.acquisition_date)}</td>
                  <td className="text-center capitalize">{conditionLabel(a.condition_status)}</td>
                  <td className="text-center capitalize">{statusLabel(a.asset_status)}</td>
                  <td className="text-right font-medium">{formatRupiah(a.acquisition_price)}</td>
                </tr>
              ))
            )}
          </tbody>
          {filteredAssets.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: "#f8f9fa", fontWeight: "bold" }}>
                <td colSpan={8} className="text-right uppercase px-2 font-bold">
                  TOTAL NILAI INVESTASI ASET ({totalCount} UNIT):
                </td>
                <td className="text-right font-bold">{formatRupiah(totalValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Lembar Tanda Tangan Resmi */}
        <div className="no-break mt-6 flex justify-between items-start text-[8.5pt] px-4">
          <div className="text-center w-52">
            <p className="text-gray-600">Mengetahui,</p>
            <p className="font-bold text-black uppercase mt-0.5">Pengurus Barang Pengguna</p>
            <div className="h-16"></div>
            <p className="font-bold underline text-black uppercase">
              ( ........................................ )
            </p>
            <p className="text-[7.5pt] text-gray-600 mt-0.5">
              NIP. ........................................
            </p>
          </div>

          <div className="text-center w-52">
            <p className="text-gray-600">Bondowoso, {formatDate(new Date().toISOString())}</p>
            <p className="font-bold text-black uppercase mt-0.5">Kepala Dinas Kominfo</p>
            <div className="h-16"></div>
            <p className="font-bold underline text-black uppercase">
              ( ........................................ )
            </p>
            <p className="text-[7.5pt] text-gray-600 mt-0.5">
              NIP. ........................................
            </p>
          </div>
        </div>

        {/* Catatan Kaki Dokumen Resmi (Pojok Kiri Bawah) */}
        <div className="no-break mt-8 pt-2 border-t border-gray-300 flex justify-between items-center text-[7.5pt] text-gray-500">
          <span className="font-semibold text-black">
            MINDSET - Manajemen Informasi Data Aset
          </span>
          <span className="italic">
            Dokumen Laporan Resmi Dinas Komunikasi dan Informatika Kabupaten Bondowoso
          </span>
        </div>
      </div>
    </div>
  );
}
