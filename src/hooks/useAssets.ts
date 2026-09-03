import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoryRow {
  id: number;
  code: string;
  name: string;
}

export interface LocationRow {
  id: number;
  code: string;
  name: string;
  building: string | null;
  room: string | null;
}

export interface CategoryWithCount {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: string;
  count: number;
}

export interface LocationWithCount {
  id: number;
  code: string;
  name: string;
  description: string | null;
  building: string | null;
  room: string | null;
  floor: string | null;
  status: string;
  count: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories", "active"],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, code, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCategoriesWithCount() {
  return useQuery({
    queryKey: ["categories-with-count"],
    queryFn: async (): Promise<CategoryWithCount[]> => {
      const [{ data: categories, error: catError }, { data: assets, error: assetError }] =
        await Promise.all([
          supabase.from("categories").select("id, code, name, description, status").order("id"),
          supabase.from("assets").select("category_id").is("deleted_at", null),
        ]);

      if (catError) throw catError;
      if (assetError) throw assetError;

      const counts: Record<number, number> = {};
      for (const a of assets || []) {
        if (a.category_id) {
          counts[a.category_id] = (counts[a.category_id] || 0) + 1;
        }
      }

      return (categories || []).map((c) => ({
        ...c,
        count: counts[c.id] || 0,
      }));
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations", "active"],
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, code, name, building, room")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useLocationsWithCount() {
  return useQuery({
    queryKey: ["locations-with-count"],
    queryFn: async (): Promise<LocationWithCount[]> => {
      const [{ data: locations, error: locError }, { data: assets, error: assetError }] =
        await Promise.all([
          supabase
            .from("locations")
            .select("id, code, name, description, building, room, floor, status")
            .order("id"),
          supabase.from("assets").select("location_id").is("deleted_at", null),
        ]);

      if (locError) throw locError;
      if (assetError) throw assetError;

      const counts: Record<number, number> = {};
      for (const a of assets || []) {
        if (a.location_id) {
          counts[a.location_id] = (counts[a.location_id] || 0) + 1;
        }
      }

      return (locations || []).map((l) => ({
        ...l,
        count: counts[l.id] || 0,
      }));
    },
  });
}

export interface AssetListRow {
  id: string;
  asset_code: string;
  asset_name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  condition_status: string;
  asset_status: string;
  acquisition_date: string;
  acquisition_price: number;
  description: string | null;
  quantity?: number;
  category_id: number;
  location_id: number;
  categories: { name: string } | null;
  locations: { name: string; room: string | null } | null;
}

export interface AssetFilters {
  search: string;
  categoryId: string;
  locationId: string;
  condition: string;
  status: string;
  page: number;
  pageSize: number;
}

export function useAssetList(filters: AssetFilters) {
  return useQuery({
    queryKey: ["assets", filters],
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select(
          "id, asset_code, asset_name, brand, model, serial_number, condition_status, asset_status, acquisition_date, acquisition_price, quantity, description, category_id, location_id, categories(name), locations(name, room)",
          { count: "exact" },
        )
        .is("deleted_at", null);

      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `asset_name.ilike.${term},asset_code.ilike.${term},serial_number.ilike.${term},brand.ilike.${term}`,
        );
      }
      if (filters.categoryId !== "all") query = query.eq("category_id", Number(filters.categoryId));
      if (filters.locationId !== "all") query = query.eq("location_id", Number(filters.locationId));
      if (filters.condition !== "all") query = query.eq("condition_status", filters.condition);
      if (filters.status !== "all") query = query.eq("asset_status", filters.status);

      const from = (filters.page - 1) * filters.pageSize;
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, from + filters.pageSize - 1);

      if (error) throw error;
      return { rows: (data ?? []) as unknown as AssetListRow[], total: count ?? 0 };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
  });
}

export interface AssetDetail {
  id: string;
  asset_code: string;
  asset_name: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  specification: string | null;
  acquisition_date: string;
  acquisition_price: number;
  useful_life_years: number | null;
  residual_value: number;
  condition_status: string;
  asset_status: string;
  ownership_status: string;
  quantity?: number;
  description: string | null;
  category_id: number;
  location_id: number;
  created_at: string;
  updated_at: string;
  categories: { name: string; code: string } | null;
  locations: { name: string; code: string; building: string | null; room: string | null } | null;
  asset_qr_codes: {
    id: string;
    qr_token: string;
    print_count: number;
    printed_at: string | null;
  } | null;
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ["asset", id],
    queryFn: async (): Promise<AssetDetail | null> => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "*, categories(name, code), locations(name, code, building, room), asset_qr_codes(id, qr_token, print_count, printed_at)",
        )
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as AssetDetail | null;
    },
  });
}

export interface AssetPhotoRow {
  id: string;
  file_path: string;
  file_name: string | null;
  is_primary: boolean;
  created_at: string;
  signedUrl: string | null;
}

export function useAssetPhotos(assetId: string) {
  return useQuery({
    queryKey: ["asset-photos", assetId],
    queryFn: async (): Promise<AssetPhotoRow[]> => {
      if (!assetId) return [];
      const { data, error } = await supabase
        .from("asset_photos")
        .select("id, file_path, file_name, is_primary, created_at")
        .eq("asset_id", assetId)
        .order("created_at");
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const { data: signed } = await supabase.storage.from("asset-photos").createSignedUrls(
        rows.map((r) => r.file_path),
        3600,
      );
      return rows.map((r, i) => ({ ...r, signedUrl: signed?.[i]?.signedUrl ?? null }));
    },
  });
}

function getNextSequentialCode(prefix: string, values: Array<string | null | undefined>): string {
  const largest = values.reduce((max, value) => {
    if (!value) return max;
    const match = value.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`));
    if (!match) return max;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return max;
    return Math.max(max, parsed);
  }, 0);

  return `${prefix}${String(largest + 1).padStart(3, "0")}`;
}

/** Membuat kode aset berikutnya, format AST-<tahun>-<urut 3 digit>. Mengisi nomor urut yang kosong/dihapus. */
export async function generateAssetCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AST-${year}-`;
  const { data, error } = await supabase
    .from("assets")
    .select("asset_code")
    .like("asset_code", `${prefix}%`)
    .is("deleted_at", null);
  if (error) throw error;

  return getNextSequentialCode(prefix, (data ?? []).map((row) => row.asset_code));
}

/** Membuat nomor transaksi barang masuk berikutnya, format TRX-IN-<tahun>-<urut 3 digit>. */
export async function generateTransactionInCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRX-IN-${year}-`;
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("transaction_no")
    .eq("type", "IN")
    .like("transaction_no", `${prefix}%`);
  if (error) throw error;

  return getNextSequentialCode(prefix, (data ?? []).map((row) => row.transaction_no));
}

/** Membuat nomor transaksi barang keluar berikutnya, format TRX-OUT-<tahun>-<urut 3 digit>. */
export async function generateTransactionOutCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRX-OUT-${year}-`;
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("transaction_no")
    .eq("type", "OUT")
    .like("transaction_no", `${prefix}%`);
  if (error) throw error;

  return getNextSequentialCode(prefix, (data ?? []).map((row) => row.transaction_no));

  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export interface MutationRow {
  id: string;
  asset_id: string;
  from_location_id: number | null;
  to_location_id: number;
  mutation_date: string;
  reason: string | null;
  document_number: string | null;
  created_by: string | null;
  created_at: string;
  assets: { asset_code: string; asset_name: string } | null;
  from_location: { name: string; room: string | null } | null;
  to_location: { name: string; room: string | null } | null;
}

export interface LoanRow {
  id: string;
  asset_id: string;
  borrower_name: string;
  borrower_unit: string | null;
  borrower_contact: string | null;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  return_condition: string | null;
  purpose: string | null;
  status: "borrowed" | "returned" | string;
  created_by: string | null;
  created_at: string;
  assets: { asset_code: string; asset_name: string } | null;
}

export interface MaintenanceRow {
  id: string;
  asset_id: string;
  maintenance_date: string;
  maintenance_type: string;
  vendor_name: string | null;
  cost: number;
  description: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | string;
  start_date: string | null;
  finish_date: string | null;
  condition_before: string | null;
  condition_after: string | null;
  attachment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  assets: { asset_code: string; asset_name: string } | null;
}

export interface AuditScheduleRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  location_id: number | null;
  category_id: number | null;
  assigned_to: string | null;
  status: "scheduled" | "in_progress" | "completed" | string;
  notes: string | null;
  created_at: string;
  locations: { name: string; room: string | null } | null;
  categories: { name: string } | null;
  assigned_user: { full_name: string | null; email: string | null } | null;
}

export interface AuditResultRow {
  id: string;
  audit_schedule_id: string;
  asset_id: string;
  physical_found: boolean;
  code_match: boolean;
  location_match: boolean;
  condition_match: boolean;
  audit_status: string;
  notes: string | null;
  recommendation: string | null;
  created_at: string;
  assets?: { asset_code: string; asset_name: string } | null;
  audit_schedules?: { title: string } | null;
}

export interface AuditFindingRow {
  id: string;
  audit_result_id: string;
  finding_type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  recommendation: string | null;
  status: "open" | "in_progress" | "resolved" | "closed" | string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_user: { full_name: string | null } | null;
  audit_results:
    | (AuditResultRow & {
        assets: { asset_code: string; asset_name: string } | null;
        audit_schedules: { title: string } | null;
      })
    | null;
}

export interface ScopeAssetRow {
  id: string;
  asset_code: string;
  asset_name: string;
  location_id: number | null;
  category_id: number | null;
  condition_status: string;
  locations: { name: string; room: string | null } | null;
  categories: { name: string } | null;
}

export function useMutationsList() {
  return useQuery({
    queryKey: ["mutations-list"],
    queryFn: async (): Promise<MutationRow[]> => {
      const { data, error } = await supabase
        .from("asset_mutations")
        .select(
          `
          *,
          assets(asset_code, asset_name),
          from_location:locations!from_location_id(name, room),
          to_location:locations!to_location_id(name, room)
        `,
        )
        .order("mutation_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MutationRow[];
    },
  });
}

export function useLoansList() {
  return useQuery({
    queryKey: ["loans-list"],
    queryFn: async (): Promise<LoanRow[]> => {
      const { data, error } = await supabase
        .from("asset_loans")
        .select(
          `
          *,
          assets(asset_code, asset_name)
        `,
        )
        .order("loan_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LoanRow[];
    },
  });
}

export function useMaintenanceList() {
  return useQuery({
    queryKey: ["maintenance-list"],
    queryFn: async (): Promise<MaintenanceRow[]> => {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select(
          `
          *,
          assets(asset_code, asset_name)
        `,
        )
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceRow[];
    },
  });
}

export function useAuditSchedules() {
  return useQuery({
    queryKey: ["audit-schedules"],
    queryFn: async (): Promise<AuditScheduleRow[]> => {
      const { data, error } = await supabase
        .from("audit_schedules")
        .select(
          `
          *,
          locations(name, room),
          categories(name),
          assigned_user:users!audit_schedules_assigned_to_fkey(full_name, email)
        `,
        )
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuditScheduleRow[];
    },
  });
}

export function useAuditFindings() {
  return useQuery({
    queryKey: ["audit-findings"],
    queryFn: async (): Promise<AuditFindingRow[]> => {
      const { data, error } = await supabase
        .from("audit_findings")
        .select(
          `
          *,
          resolved_user:users!audit_findings_resolved_by_fkey(full_name),
          audit_results(
            *,
            assets(asset_code, asset_name),
            audit_schedules(title)
          )
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuditFindingRow[];
    },
  });
}
