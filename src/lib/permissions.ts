export type AppRole = "admin_utama" | "operator_aset" | "auditor" | "pimpinan";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin_utama: "Admin Utama",
  operator_aset: "Operator Aset",
  auditor: "Auditor",
  pimpinan: "Pimpinan",
};

/** Kunci modul aplikasi. */
export type ModuleKey =
  | "dashboard"
  | "assets"
  | "categories"
  | "locations"
  | "qr"
  | "scan"
  | "mutations"
  | "loans"
  | "maintenance"
  | "audit"
  | "reports"
  | "activity-logs"
  | "users"
  | "settings"
  | "vendors"
  | "work-types"
  | "transactions-in"
  | "transactions-out";

const ACCESS: Record<AppRole, ModuleKey[]> = {
  admin_utama: [
    "dashboard",
    "assets",
    "categories",
    "locations",
    "qr",
    "scan",
    "mutations",
    "loans",
    "maintenance",
    "audit",
    "reports",
    "activity-logs",
    "users",
    "settings",
    "vendors",
    "work-types",
    "transactions-in",
    "transactions-out",
  ],
  operator_aset: [
    "dashboard",
    "assets",
    "categories",
    "locations",
    "qr",
    "scan",
    "mutations",
    "loans",
    "maintenance",
    "reports",
    "activity-logs",
    "vendors",
    "work-types",
    "transactions-in",
    "transactions-out",
  ],
  auditor: ["dashboard", "scan", "assets", "audit", "reports", "activity-logs"],
  pimpinan: ["dashboard", "assets", "reports", "activity-logs"],
};

export function canAccess(role: AppRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ACCESS[role].includes(module);
}

/** Peran yang boleh mengubah master data aset & transaksi. */
export function canWriteAssets(role: AppRole | null | undefined): boolean {
  return role === "admin_utama" || role === "operator_aset";
}

export function canAudit(role: AppRole | null | undefined): boolean {
  return role === "admin_utama" || role === "auditor";
}

export function isReadOnly(role: AppRole | null | undefined): boolean {
  return role === "pimpinan";
}
