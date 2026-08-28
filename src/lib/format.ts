export function formatRupiah(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Penyusutan garis lurus sesuai umur ekonomis dan nilai residu. */
export function calcDepreciation(input: {
  acquisitionDate: string;
  acquisitionPrice: number;
  usefulLifeYears: number | null;
  residualValue: number;
}) {
  const { acquisitionPrice, residualValue } = input;
  const life = input.usefulLifeYears ?? 0;
  if (!life || life <= 0) {
    return { perYear: 0, elapsedYears: 0, accumulated: 0, bookValue: acquisitionPrice };
  }
  const perYear = Math.max(0, (acquisitionPrice - residualValue) / life);
  const start = new Date(input.acquisitionDate).getTime();
  const elapsedYears = Math.max(0, (Date.now() - start) / (365.25 * 24 * 3600 * 1000));
  const accumulated = Math.min(perYear * elapsedYears, acquisitionPrice - residualValue);
  return {
    perYear,
    elapsedYears,
    accumulated,
    bookValue: Math.max(residualValue, acquisitionPrice - accumulated),
  };
}
