import { useEffect, useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ShieldAlert, Monitor, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  conditionBadgeClass,
  conditionLabel,
  statusBadgeClass,
  statusLabel,
} from "@/lib/asset-options";

export const Route = createFileRoute("/scan/$token")({
  component: PublicScanResultPage,
  head: () => ({
    meta: [
      { title: "Verifikasi Aset - MINDSET Diskominfo" },
      { name: "description", content: "Hasil pemindaian QR Code aset." },
    ],
  }),
});

type ScannedAsset = {
  id: string;
  asset_code: string;
  asset_name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  condition_status: string;
  asset_status: string;
  acquisition_date: string | null;
  acquisition_price: number | null;
  categories: { name: string } | null;
  locations: { name: string; building: string | null; room: string | null } | null;
};

function PublicScanResultPage() {
  const { token } = Route.useParams();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [asset, setAsset] = useState<ScannedAsset | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchAssetAndLog() {
      try {
        setLoading(true);

        // Use RPC to securely fetch asset data regardless of auth state (bypasses RLS safely)
        const { data: assetData, error: assetError } = await (
          supabase as unknown as {
            rpc: (
              fn: string,
              args: Record<string, unknown>,
            ) => Promise<{ data: unknown; error: Error | null }>;
          }
        ).rpc("get_public_asset_by_token", { token_val: token });

        if (assetError) throw assetError;

        if (!assetData) {
          setErrorMsg("QR Code Tidak Ditemukan. Token tidak valid atau sudah ditarik/diarsipkan.");
          setLoading(false);
          return;
        }

        const typedAsset = assetData as unknown as ScannedAsset;

        if (isMounted) {
          setAsset(typedAsset);
        }

        // 3. Log Scan (only once per mount)
        if (!hasLoggedRef.current) {
          hasLoggedRef.current = true;
          setLogged(true);
          const ua = navigator.userAgent;
          const isMobile = /Mobi|Android/i.test(ua);

          await supabase.from("qr_scan_logs").insert({
            asset_id: typedAsset.id,
            user_id: user?.id || null,
            device_type: isMobile ? "Mobile" : "Desktop",
            browser: navigator.vendor || "Unknown",
            platform: navigator.platform || "Unknown",
            scan_result: "SUCCESS",
          });
        }
      } catch (err) {
        console.error("Scan verification error:", err);
        if (isMounted) setErrorMsg("Terjadi kesalahan saat memverifikasi QR Code.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (!userLoading) {
      fetchAssetAndLog();
    }

    return () => {
      isMounted = false;
    };
  }, [token, userLoading, user?.id]);

  // View state: if loading
  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
        <Skeleton className="h-16 w-16 rounded-full mb-4" />
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-64 w-full max-w-md rounded-xl" />
      </div>
    );
  }

  // View state: error (not found, deleted)
  if (errorMsg || !asset) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
        <div className="bg-card border border-border shadow-lg rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button asChild className="w-full mt-4">
            <Link to="/">Kembali ke Beranda</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isInternal = !!user;

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header / Brand */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground mb-2 shadow-lg">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">MINDSET Verified</h1>
          <p className="text-sm text-muted-foreground">Aset Resmi Diskominfo terverifikasi.</p>
        </div>

        {/* Card Data */}
        <div className="bg-card border border-border shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-primary/5 px-6 py-5 border-b border-border/50">
            <h2 className="text-lg font-bold text-foreground">{asset.asset_name}</h2>
            <p className="text-sm font-mono text-muted-foreground mt-1">{asset.asset_code}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={conditionBadgeClass(asset.condition_status)}>
                {conditionLabel(asset.condition_status)}
              </Badge>
              <Badge variant="outline" className={statusBadgeClass(asset.asset_status)}>
                {statusLabel(asset.asset_status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                  Kategori
                </p>
                <p className="font-medium">{asset.categories?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                  Lokasi
                </p>
                <p className="font-medium">{asset.locations?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                  Merk
                </p>
                <p className="font-medium">{asset.brand || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                  Model / Tipe
                </p>
                <p className="font-medium">{asset.model || "-"}</p>
              </div>
            </div>

            {/* Internal Only Data */}
            {isInternal && (
              <div className="mt-6 pt-4 border-t border-border space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="size-4 text-primary" />
                  <h3 className="font-semibold text-sm text-primary">Informasi Internal</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                      No. Seri
                    </p>
                    <p className="font-medium font-mono">{asset.serial_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                      Tgl Perolehan
                    </p>
                    <p className="font-medium">
                      {asset.acquisition_date
                        ? new Date(asset.acquisition_date).toLocaleDateString("id-ID")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1 font-semibold">
                      Harga Perolehan
                    </p>
                    <p className="font-medium">
                      {asset.acquisition_price
                        ? new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          }).format(asset.acquisition_price)
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1 bg-card">
            <Link to="/">Beranda Utama</Link>
          </Button>
          {isInternal && (
            <Button asChild className="flex-1">
              <Link to="/assets/$id" params={{ id: asset.id }}>
                Buka di MINDSET
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function setLogged(arg0: boolean) {
  throw new Error("Function not implemented.");
}
