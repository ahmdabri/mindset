export const CONDITION_OPTIONS = [
  { value: "baik", label: "Baik" },
  { value: "rusak_ringan", label: "Rusak Ringan" },
  { value: "rusak_berat", label: "Rusak Berat" },
  { value: "hilang", label: "Hilang" },
] as const;

export const STATUS_OPTIONS = [
  { value: "tersedia", label: "Tersedia" },
  { value: "dipinjam", label: "Dipinjam" },
  { value: "maintenance", label: "Maintenance" },
  { value: "dihapus", label: "Dihapuskan" },
] as const;

export const OWNERSHIP_OPTIONS = [
  { value: "milik_sendiri", label: "Milik Sendiri" },
  { value: "hibah", label: "Hibah" },
  { value: "sewa", label: "Sewa" },
  { value: "pinjam_pakai", label: "Pinjam Pakai" },
] as const;

function labelOf(list: readonly { value: string; label: string }[], value: string | null) {
  return list.find((o) => o.value === value)?.label ?? value ?? "-";
}

export const conditionLabel = (v: string | null) => labelOf(CONDITION_OPTIONS, v);
export const statusLabel = (v: string | null) => labelOf(STATUS_OPTIONS, v);
export const ownershipLabel = (v: string | null) => labelOf(OWNERSHIP_OPTIONS, v);

/** Kelas warna badge berbasis token desain (tanpa warna hardcoded). */
export function conditionBadgeClass(v: string | null): string {
  switch (v) {
    case "baik":
      return "bg-success-soft text-success border-transparent";
    case "rusak_ringan":
      return "bg-warning-soft text-warning border-transparent";
    case "rusak_berat":
    case "hilang":
      return "bg-destructive/10 text-destructive border-transparent";
    default:
      return "bg-muted text-muted-foreground border-transparent";
  }
}

export function statusBadgeClass(v: string | null): string {
  switch (v) {
    case "tersedia":
      return "bg-success-soft text-success border-transparent";
    case "dipinjam":
      return "bg-info-soft text-info border-transparent";
    case "maintenance":
      return "bg-warning-soft text-warning border-transparent";
    case "dihapus":
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "bg-muted text-muted-foreground border-transparent";
  }
}
