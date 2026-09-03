import { useState, useEffect } from "react";
import { Maximize2, ImageIcon, Star } from "lucide-react";

import { useAssetPhotos } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AssetPhotoGallery({ assetId, assetCode }: { assetId: string; assetCode: string }) {
  const { data: photos, isPending } = useAssetPhotos(assetId);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Set default selected photo to primary or first photo
  useEffect(() => {
    if (photos && photos.length > 0) {
      if (!selectedPhotoId || !photos.some((p) => p.id === selectedPhotoId)) {
        const primary = photos.find((p) => p.is_primary) ?? photos[0];
        if (primary?.id) {
          setSelectedPhotoId(primary.id);
        }
      }
    } else {
      setSelectedPhotoId(null);
    }
  }, [photos, selectedPhotoId]);

  if (isPending) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-foreground mb-4">Foto Aset</h2>
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <Skeleton className="aspect-[4/3] w-full max-w-[320px] max-h-[240px] rounded-xl" />
          <div className="grid grid-cols-4 gap-2 w-full max-w-[320px]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const photoList = photos ?? [];
  const currentPhoto = photoList.find((p) => p.id === selectedPhotoId) || photoList[0];

  if (photoList.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-foreground mb-4">Foto Aset</h2>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 p-6 text-center text-muted-foreground min-h-[200px]">
          <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground mb-2">
            <ImageIcon className="size-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">Belum Ada Foto Aset</p>
          <p className="mt-1 text-[11px] text-muted-foreground max-w-[200px]">
            Foto dapat diunggah melalui tombol <strong>Edit</strong> di atas.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground mb-4">Foto Aset</h2>

      <div className="flex flex-col items-center justify-center space-y-3">
        {/* Foto Utama: Ukuran Kompak, Rasio 4:3, Terbingkai Rapi */}
        <div className="group relative aspect-[4/3] w-full max-w-[340px] max-h-[250px] overflow-hidden rounded-xl border border-border bg-muted/20 shadow-xs transition-all">
          {currentPhoto?.signedUrl ? (
            <img
              src={currentPhoto.signedUrl}
              alt={currentPhoto.file_name ?? `Foto ${assetCode}`}
              className="h-full w-full object-contain p-2 cursor-pointer transition-transform duration-300 group-hover:scale-105"
              onClick={() => setPreviewOpen(true)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-muted text-xs text-muted-foreground">
              Gambar tidak tersedia
            </div>
          )}

          {currentPhoto?.is_primary && (
            <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-md bg-primary/95 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-xs backdrop-blur-sm">
              <Star className="size-2.5 fill-primary-foreground" /> Utama
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-2.5 right-2.5 z-10 size-7 rounded-md bg-background/85 text-foreground backdrop-blur-md hover:bg-muted shadow-xs border border-border/50"
            onClick={() => setPreviewOpen(true)}
            title="Perbesar Tampilan"
          >
            <Maximize2 className="size-3" />
          </Button>
        </div>

        {/* Thumbnail Preview jika lebih dari 1 foto */}
        {photoList.length > 1 && (
          <div className="grid grid-cols-4 gap-2 w-full max-w-[340px]">
            {photoList.map((photo) => {
              const isActive = photo.id === currentPhoto?.id;
              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhotoId(photo.id)}
                  className={`group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-md border transition-all ${
                    isActive
                      ? "border-primary ring-2 ring-primary/30 shadow-xs"
                      : "border-border bg-muted/20 hover:border-primary/60 opacity-80 hover:opacity-100"
                  }`}
                >
                  {photo.signedUrl ? (
                    <img
                      src={photo.signedUrl}
                      alt={photo.file_name ?? "Thumbnail"}
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-muted text-[8px] text-muted-foreground">
                      -
                    </div>
                  )}
                  {photo.is_primary && (
                    <span className="absolute left-0.5 top-0.5 rounded bg-primary/90 px-1 py-0.2 text-[7px] font-semibold text-primary-foreground">
                      Utama
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-2 sm:p-4">
          <DialogHeader className="px-2 pt-2">
            <DialogTitle className="text-base font-medium">
              {currentPhoto?.file_name || `Foto Aset ${assetCode}`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex max-h-[80vh] items-center justify-center overflow-hidden rounded-xl bg-black/5 p-2">
            {currentPhoto?.signedUrl && (
              <img
                src={currentPhoto.signedUrl}
                alt={currentPhoto.file_name ?? "Preview foto"}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
