import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, AlertCircle, RefreshCw, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan QR Code Aset - MINDSET Diskominfo" },
      { name: "description", content: "Pindai QR aset menggunakan kamera perangkat." },
      { property: "og:title", content: "Scan QR Code Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Pindai QR aset menggunakan kamera perangkat." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="scan">
      <ScannerContainer />
    </ModuleGuard>
  );
}

interface ScannedAssetResult {
  id: string;
  asset_code: string;
  asset_name: string;
  condition_status?: string | null;
  asset_status?: string | null;
  categories?: { name: string } | null;
  locations?: { name: string } | null;
}

function ScannerContainer() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<ScannedAssetResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = () => {
    setErrorMsg(null);
    setScanResult(null);
    setIsScanning(true);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      if (scanner.isScanning) {
        scanner.stop().catch((e) => console.error("Error stopping scanner:", e));
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    let mounted = true;

    if (isScanning) {
      // Small timeout to ensure DOM has rendered the container
      const timer = setTimeout(async () => {
        if (!mounted) return;

        try {
          if (window.isSecureContext === false) {
            throw new Error("SECURE_CONTEXT_REQUIRED");
          }
          const scanner = new Html5Qrcode("qr-reader-container");
          scannerRef.current = scanner;

          const qrConfig = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          };

          const onScanSuccess = async (decodedText: string) => {
            stopScanner();
            await processDecodedText(decodedText);
          };

          const onScanFailure = () => {
            // ignore normal scan failures
          };

          // Try environment camera first
          try {
            await scanner.start(
              { facingMode: "environment" },
              qrConfig,
              onScanSuccess,
              onScanFailure,
            );
          } catch (envError) {
            console.warn(
              "Failed to start environment camera, falling back to any camera",
              envError,
            );
            if (!mounted) return;

            // If environment camera fails (e.g. on laptops), get all cameras and pick the first one
            const devices = await Html5Qrcode.getCameras();
            const backCamera = devices.find(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("environment"),
            );
            const firstDevice = backCamera || (devices && devices.length > 0 ? devices[0] : null);
            if (firstDevice && firstDevice.id) {
              await scanner.start(firstDevice.id, qrConfig, onScanSuccess, onScanFailure);
            } else {
              throw new Error("No cameras found");
            }
          }
        } catch (err) {
          console.error("Camera startup error:", err);
          if (mounted) {
            stopScanner();
            const errStr = String(err);
            if (errStr.includes("SECURE_CONTEXT_REQUIRED")) {
              setErrorMsg(
                "Kamera tidak dapat diakses melalui koneksi tidak aman (HTTP). Silakan gunakan koneksi HTTPS, akses melalui localhost, atau gunakan tunnel seperti ngrok untuk testing di perangkat lain.",
              );
            } else if (
              errStr.includes("NotReadableError") ||
              errStr.includes("Could not start video source")
            ) {
              setErrorMsg(
                "Kamera gagal diakses karena sedang digunakan oleh aplikasi lain (seperti Zoom, Discord, OBS, atau browser tab lain). Tutup aplikasi tersebut lalu coba lagi.",
              );
            } else if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied")) {
              setErrorMsg(
                "Akses kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda.",
              );
            } else {
              setErrorMsg(
                "Gagal mengakses kamera: " +
                  (err instanceof Error
                    ? err.message
                    : "Perangkat tidak ditemukan atau izin belum diberikan."),
              );
            }
          }
        }
      }, 150);

      return () => {
        mounted = false;
        clearTimeout(timer);
      };
    }

    // Cleanup on unmount or when scanning stops
    return () => {
      mounted = false;
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        if (scanner.isScanning) {
          scanner.stop().catch((e) => console.error("Cleanup stop error:", e));
        }
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const processDecodedText = async (text: string) => {
    setChecking(true);
    setErrorMsg(null);

    try {
      // 1. Try to extract asset ID directly from URL
      // Pattern matching: /assets/uuid-string
      const uuidPattern =
        /\/assets\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
      const match = text.match(uuidPattern);

      if (match && match[1]) {
        const assetId = match[1];

        // Verify asset exists in DB
        const { data, error } = await supabase
          .from("assets")
          .select("*, categories(name), locations(name)")
          .eq("id", assetId)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          toast.success("Aset ditemukan!");
          setScanResult(data as unknown as ScannedAssetResult);
          return;
        }
      }

      // 2. Fallback: treat text as raw qr_token
      // Strip any URL prefix if present (e.g. if the user only scanned the token part)
      const token = text.split("/").pop() || text;

      const { data: qrData, error: qrError } = await supabase
        .from("asset_qr_codes")
        .select("asset_id")
        .eq("qr_token", token)
        .maybeSingle();

      if (qrError) throw qrError;

      if (qrData) {
        // Verify asset exists and is active
        const { data: assetData, error: assetError } = await supabase
          .from("assets")
          .select("*, categories(name), locations(name)")
          .eq("id", qrData.asset_id)
          .is("deleted_at", null)
          .maybeSingle();

        if (assetError) throw assetError;

        if (assetData) {
          toast.success("Aset ditemukan!");
          setScanResult(assetData as unknown as ScannedAssetResult);
          return;
        }
      }

      // 3. Fallback: treat text as asset_code directly
      const { data: directAssetData, error: directAssetError } = await supabase
        .from("assets")
        .select("*, categories(name), locations(name)")
        .eq("asset_code", text.trim())
        .is("deleted_at", null)
        .maybeSingle();

      if (directAssetError) throw directAssetError;

      if (directAssetData) {
        toast.success("Aset ditemukan!");
        setScanResult(directAssetData as unknown as ScannedAssetResult);
        return;
      }

      // 4. Not found
      setErrorMsg("Aset tidak ditemukan dalam sistem. Pastikan kode aset atau QR Code valid.");
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan saat memproses data QR Code.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CSS custom untuk modifikasi tampilan html5-qrcode agar premium */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        #qr-reader-container {
          border: none !important;
        }
        #qr-reader-container__dashboard {
          padding: 10px !important;
          background: transparent !important;
        }
        #qr-reader-container__camera_selection {
          background-color: var(--secondary) !important;
          color: var(--secondary-foreground) !important;
          border: 1px border-input !important;
          border-radius: var(--radius-md) !important;
          padding: 6px !important;
          font-size: 13px !important;
        }
        #html5-qrcode-button-camera-start,
        #html5-qrcode-button-camera-stop,
        #html5-qrcode-button-camera-permission {
          background-color: var(--primary) !important;
          color: var(--primary-foreground) !important;
          border-radius: var(--radius-md) !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          padding: 8px 16px !important;
          border: none !important;
          cursor: pointer !important;
        }
        #html5-qrcode-button-camera-start:hover,
        #html5-qrcode-button-camera-permission:hover {
          opacity: 0.9 !important;
        }
        @keyframes scanLaser {
          0%, 100% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
        }
      `,
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Scan QR Code Aset</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pindai QR aset menggunakan kamera perangkat untuk verifikasi cepat
          </p>
        </div>
        {!isScanning ? (
          <Button onClick={startScanner}>
            <Camera className="mr-2 size-4" />
            Mulai Scan
          </Button>
        ) : (
          <Button
            onClick={stopScanner}
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <CameraOff className="mr-2 size-4" />
            Matikan Kamera
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kolom Kiri: Scanner */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-6">
          <div className="rounded-xl border border-border bg-background overflow-hidden relative min-h-[300px] flex flex-col items-center justify-center">
            {!isScanning && !scanResult && !errorMsg && !checking && (
              <div className="py-10 text-center space-y-4 px-4">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                  <div className="grid grid-cols-2 gap-1 opacity-50">
                    <div className="w-2 h-2 rounded-sm border-2 border-current"></div>
                    <div className="w-2 h-2 rounded-sm border-2 border-current"></div>
                    <div className="w-2 h-2 rounded-sm border-2 border-current"></div>
                    <div className="w-2 h-2 rounded-sm border-2 border-current"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-foreground">Kamera belum aktif</h3>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    Tekan tombol "Mulai Scan" di kanan atas lalu izinkan akses kamera perangkat
                    untuk memindai label QR.
                  </p>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="w-full h-full p-4">
                <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-square max-w-[320px] mx-auto">
                  <div id="qr-reader-container" className="w-full h-full" />

                  {/* Overlay laser pemindai */}
                  <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40">
                    <div className="absolute left-[15%] right-[15%] top-[15%] bottom-[15%] border-2 border-primary/80 rounded">
                      <div className="w-full h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] absolute top-0 left-0 animate-[scanLaser_2.5s_ease-in-out_infinite]" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Arahkan kamera perangkat Anda tepat ke kode QR aset.
                </p>
              </div>
            )}

            {checking && (
              <div className="py-12 space-y-4 text-center">
                <RefreshCw className="size-8 text-primary animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-semibold">Memproses Data QR...</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mencocokkan informasi aset di database
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="py-10 text-center space-y-4 px-4">
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                  <AlertCircle className="size-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Pemindaian Gagal</h3>
                  <p className="text-sm text-destructive-foreground font-medium max-w-[280px] mx-auto">
                    {errorMsg}
                  </p>
                </div>
                <Button onClick={startScanner} variant="outline" size="sm" className="mt-2">
                  Coba Lagi
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Input Kode Aset Manual</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Atau tempel token / URL QR di sini..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                id="manual-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    processDecodedText(e.currentTarget.value);
                  }
                }}
              />
              <Button
                onClick={() => {
                  const input = document.getElementById("manual-input") as HTMLInputElement;
                  if (input && input.value) {
                    processDecodedText(input.value);
                  }
                }}
              >
                Cek Aset
              </Button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Hasil */}
        <div className="space-y-4 flex flex-col">
          <h3 className="text-lg font-bold">Hasil Pemindaian</h3>

          <div className="flex-1 flex flex-col">
            {!scanResult || errorMsg ? (
              <div className="rounded-xl border border-dashed border-border bg-background/50 flex-1 flex flex-col items-center justify-center text-center p-10 min-h-[300px]">
                <div className="w-12 h-12 flex items-center justify-center text-muted-foreground opacity-30 mb-4">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7V4h3" />
                    <path d="M20 7V4h-3" />
                    <path d="M4 17v3h3" />
                    <path d="M20 17v3h-3" />
                    <path d="M9 12h6" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Belum ada aset yang dipindai. Nyalakan kamera atau input kode manual di panel
                  sebelah kiri.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center text-success mb-2">
                  <CheckCircle2 className="size-8" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">{scanResult.asset_name}</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    {scanResult.asset_code}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full text-left mt-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Kategori
                    </p>
                    <p className="text-sm font-medium">{scanResult.categories?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Lokasi
                    </p>
                    <p className="text-sm font-medium">{scanResult.locations?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Status Kondisi
                    </p>
                    <p className="text-sm font-medium capitalize">
                      {scanResult.condition_status || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Status Aset
                    </p>
                    <p className="text-sm font-medium capitalize">
                      {scanResult.asset_status || "-"}
                    </p>
                  </div>
                </div>

                <div className="w-full flex gap-3 mt-6 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setScanResult(null);
                      startScanner();
                    }}
                  >
                    Tutup
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => navigate({ to: "/assets/$id", params: { id: scanResult.id } })}
                  >
                    Lihat Detail Aset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS custom untuk modifikasi tampilan html5-qrcode agar premium */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scanLaser {
          0%, 100% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
        }
      `,
        }}
      />
    </div>
  );
}
