import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, QrCode, Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { generateUUID } from "@/lib/utils";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { AssetPhotoGallery } from "@/components/assets/AssetPhotoGallery";
import { useAsset } from "@/hooks/useAssets";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canWriteAssets } from "@/lib/permissions";
import { calcDepreciation, formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import {
  conditionBadgeClass,
  conditionLabel,
  ownershipLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/asset-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/assets_/$id")({
  head: () => ({
    meta: [
      { title: "Detail Aset - MINDSET Diskominfo" },
      { name: "description", content: "Informasi lengkap, penyusutan, dan foto aset Diskominfo." },
      { property: "og:title", content: "Detail Aset - MINDSET Diskominfo" },
      {
        property: "og:description",
        content: "Informasi lengkap, penyusutan, dan foto aset Diskominfo.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="assets">
      <DetailView />
    </ModuleGuard>
  );
}

function DetailView() {
  const { id } = Route.useParams();
  const { data: asset, isPending, isError } = useAsset(id);
  const { data: user } = useCurrentUser();
  const canEdit = canWriteAssets(user?.role);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!asset) return;
    setPrinting(true);
    try {
      const now = new Date().toISOString();
      if (asset.asset_qr_codes) {
        await supabase
          .from("asset_qr_codes")
          .update({
            printed_at: now,
            print_count: (asset.asset_qr_codes.print_count || 0) + 1,
          })
          .eq("id", asset.asset_qr_codes.id);
      } else {
        const token = generateUUID().replace(/-/g, "");
        await supabase.from("asset_qr_codes").insert({
          asset_id: asset.id,
          qr_token: token,
          printed_at: now,
          print_count: 1,
        });
      }

      await logActivity({
        action: "PRINT",
        module: "qr",
        tableName: "asset_qr_codes",
        description: `Mencetak label QR Code aset ${asset.asset_code} - ${asset.asset_name}`,
      });

      toast.success("Mempersiapkan halaman cetak...");
      setTimeout(() => {
        window.print();
        setPrinting(false);
        queryClient.invalidateQueries({ queryKey: ["asset", id] });
      }, 500);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mencetak label.");
      setPrinting(false);
    }
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm font-medium">Aset tidak ditemukan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Data mungkin sudah dihapus atau tautan tidak valid.
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link to="/assets">
            <ArrowLeft className="size-4" /> Kembali ke Data Aset
          </Link>
        </Button>
      </div>
    );
  }

  const dep = calcDepreciation({
    acquisitionDate: asset.acquisition_date,
    acquisitionPrice: Number(asset.acquisition_price),
    usefulLifeYears: asset.useful_life_years,
    residualValue: Number(asset.residual_value),
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/assets">
          <ArrowLeft className="size-4" /> Kembali ke Data Aset
        </Link>
      </Button>

      <PageHeader
        title={asset.asset_name}
        description={`${asset.asset_code} | ${asset.categories?.name ?? "-"}`}
        actions={
          <>
            <Button variant="outline" onClick={handlePrint} disabled={printing}>
              <Printer className="size-4" /> Cetak Label
            </Button>
            <Button asChild variant="outline">
              <Link to="/qr">
                <QrCode className="size-4" /> QR Code
              </Link>
            </Button>
            {canEdit ? (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={conditionBadgeClass(asset.condition_status)}>
          {conditionLabel(asset.condition_status)}
        </Badge>
        <Badge variant="outline" className={statusBadgeClass(asset.asset_status)}>
          {statusLabel(asset.asset_status)}
        </Badge>
        <Badge variant="outline">{ownershipLabel(asset.ownership_status)}</Badge>
      </div>

      {/* Konten Utama Detail Aset */}
      <div className="space-y-6">
        {/* Baris 1: Foto Aset di Kiri & Identitas Aset di Kanan */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AssetPhotoGallery assetId={asset.id} assetCode={asset.asset_code} />

          <Panel title="Identitas Aset">
            <Row label="Kode Aset" value={asset.asset_code} />
            <Row label="Nama Aset" value={asset.asset_name} />
            <Row label="Kategori" value={asset.categories?.name ?? "-"} />
            <Row label="Merk" value={asset.brand ?? "-"} />
            <Row label="Model / Tipe" value={asset.model ?? "-"} />
            <Row label="Nomor Seri" value={asset.serial_number ?? "-"} />
            <Row label="Spesifikasi" value={asset.specification ?? "-"} />
          </Panel>
        </div>

        {/* Baris 2: Lokasi & Perolehan di Kiri, Informasi Penyusutan di Kanan (1 Kotak Terpadu) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Lokasi & Perolehan">
            <Row label="Lokasi" value={asset.locations?.name ?? "-"} />
            <Row
              label="Gedung / Ruang"
              value={
                [asset.locations?.building, asset.locations?.room].filter(Boolean).join(" | ") ||
                "-"
              }
            />
            <Row label="Tanggal Perolehan" value={formatDate(asset.acquisition_date)} />
            <Row label="Harga Perolehan" value={formatRupiah(asset.acquisition_price)} />
            <Row label="Kepemilikan" value={ownershipLabel(asset.ownership_status)} />
            <Row label="Keterangan" value={asset.description ?? "-"} />
            <Row label="Terakhir diperbarui" value={formatDateTime(asset.updated_at)} />
          </Panel>

          <Panel title="Informasi & Nilai Penyusutan">
            {/* 4 Mini Stat Boxes */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Harga Perolehan</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {formatRupiah(asset.acquisition_price)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Umur Ekonomis</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {asset.useful_life_years ? `${asset.useful_life_years} tahun` : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Penyusutan / tahun</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {formatRupiah(dep.perYear)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-[11px] text-primary font-medium">Nilai Buku Saat Ini</p>
                <p className="text-sm font-bold text-primary mt-0.5">
                  {formatRupiah(dep.bookValue)}
                </p>
              </div>
            </div>

            {/* Rincian List */}
            <div className="border-t border-border pt-3 space-y-3">
              <Row label="Metode" value="Garis lurus (straight line)" />
              <Row label="Nilai Residu" value={formatRupiah(asset.residual_value)} />
              <Row label="Umur Terpakai" value={`${dep.elapsedYears.toFixed(1)} tahun`} />
              <Row label="Akumulasi Penyusutan" value={formatRupiah(dep.accumulated)} />
            </div>
          </Panel>
        </div>
      </div>

      <AssetFormDialog open={editOpen} onOpenChange={setEditOpen} asset={asset} />

      {/* CSS khusus untuk cetak label tunggal */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area-single, #print-area-single * {
            visibility: visible;
          }
          #print-area-single {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
        }
      `,
        }}
      />

      {/* Area cetak label tunggal */}
      <div id="print-area-single" className="hidden print:block print:w-full">
        <div className="flex h-[4cm] w-[8.5cm] items-center justify-between border border-dashed border-gray-400 bg-white p-3 rounded-md text-black">
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
              <QRCodeSVG
                value={`${window.location.origin}/scan/${asset.asset_qr_codes?.qr_token || asset.id}`}
                size={80}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-[7px] text-gray-400 mt-1 font-mono tracking-tighter">
              {asset.asset_qr_codes?.qr_token.slice(0, 8) || "NO-TOKEN"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
