import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import {
  Plus,
  Search,
  Calendar,
  CheckSquare,
  AlertTriangle,
  ClipboardList,
  Loader2,
  Check,
  Camera,
  CameraOff,
  UserCheck,
  ChevronRight,
  Eye,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  useAuditSchedules,
  useAuditFindings,
  useLocations,
  useCategories,
  type ScopeAssetRow,
  type AuditResultRow,
} from "@/hooks/useAssets";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canWriteAssets } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Aset - MINDSET Diskominfo" },
      { name: "description", content: "Jadwal audit, pemeriksaan, dan temuan." },
      { property: "og:title", content: "Audit Aset - MINDSET Diskominfo" },
      { property: "og:description", content: "Jadwal audit, pemeriksaan, dan temuan." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ModuleGuard module="audit">
      <div className="space-y-6">
        <PageHeader
          title="Audit Aset"
          description="Jadwal audit, pemeriksaan fisik, dan temuan mismatch"
        />
        <AuditView />
      </div>
    </ModuleGuard>
  );
}

// Schemas
const scheduleSchema = z.object({
  title: z.string().trim().min(3, "Judul audit minimal 3 karakter").max(150),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi"),
  end_date: z.string().min(1, "Tanggal selesai wajib diisi"),
  location_id: z.string().optional(),
  category_id: z.string().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const resultSchema = z.object({
  physical_found: z.boolean(),
  code_match: z.boolean(),
  location_match: z.boolean(),
  condition_match: z.boolean(),
  audit_status: z.string().min(1, "Status audit wajib dipilih"),
  notes: z.string().trim().max(1000).optional(),
  recommendation: z.string().trim().max(1000).optional(),
  // Finding fields (optional)
  create_finding: z.boolean(),
  finding_type: z.string().optional(),
  finding_desc: z.string().optional(),
  finding_severity: z.string().optional(),
  finding_recom: z.string().optional(),
});

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

function AuditView() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isAuditorOrAdmin =
    currentUser?.role === "admin_utama" ||
    currentUser?.role === "operator_aset" ||
    currentUser?.role === "auditor";

  const { data: schedules = [], isPending: schedulesPending } = useAuditSchedules();
  const { data: findings = [], isPending: findingsPending } = useAuditFindings();
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  // Tab State
  const [activeTab, setActiveTab] = useState("jadwal");

  // Search & Dialog open state
  const [searchSchedule, setSearchSchedule] = useState("");
  const [searchFinding, setSearchFinding] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Selected schedule detailed view
  const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null);

  // Form State - Jadwal
  const [schedTitle, setSchedTitle] = useState("");
  const [schedStartDate, setSchedStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedEndDate, setSchedEndDate] = useState(
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [schedLocId, setSchedLocId] = useState("");
  const [schedCatId, setSchedCatId] = useState("");
  const [schedAssignId, setSchedAssignId] = useState("");
  const [schedNotes, setSchedNotes] = useState("");

  // Form State - Checklist
  const [targetAsset, setTargetAsset] = useState<ScopeAssetRow | null>(null);
  const [physFound, setPhysFound] = useState(true);
  const [codeMatch, setCodeMatch] = useState(true);
  const [locMatch, setLocMatch] = useState(true);
  const [condMatch, setCondMatch] = useState(true);
  const [auditStatus, setAuditStatus] = useState("verified");
  const [checklistNotes, setChecklistNotes] = useState("");
  const [checklistRecom, setChecklistRecom] = useState("");

  // Finding inside Checklist State
  const [createFinding, setCreateFinding] = useState(false);
  const [findingType, setFindingType] = useState("kerusakan");
  const [findingDesc, setFindingDesc] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("medium");
  const [findingRecom, setFindingRecom] = useState("");

  // Scanner State
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Load Users List for assignment
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["users-auditors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("id, full_name, email");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedSchedule = schedules.find((s) => s.id === selectedSchedId);

  // Fetch scope assets for the selected schedule
  const { data: assetsInScope = [], isPending: assetsPending } = useQuery<ScopeAssetRow[]>({
    queryKey: ["assets-scope", selectedSchedId],
    queryFn: async (): Promise<ScopeAssetRow[]> => {
      if (!selectedSchedule) return [];
      let query = supabase
        .from("assets")
        .select(
          "id, asset_code, asset_name, location_id, category_id, condition_status, locations(name, room), categories(name)",
        )
        .is("deleted_at", null);

      if (selectedSchedule.location_id) {
        query = query.eq("location_id", selectedSchedule.location_id);
      }
      if (selectedSchedule.category_id) {
        query = query.eq("category_id", selectedSchedule.category_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ScopeAssetRow[];
    },
    enabled: !!selectedSchedId,
  });

  // Fetch audit results for the selected schedule to check which are audited
  const { data: auditResults = [], isPending: resultsPending } = useQuery<AuditResultRow[]>({
    queryKey: ["audit-results", selectedSchedId],
    queryFn: async (): Promise<AuditResultRow[]> => {
      if (!selectedSchedId) return [];
      const { data, error } = await supabase
        .from("audit_results")
        .select("*")
        .eq("audit_schedule_id", selectedSchedId);
      if (error) throw error;
      return (data || []) as unknown as AuditResultRow[];
    },
    enabled: !!selectedSchedId,
  });

  const startScanner = () => {
    if (!selectedSchedId) {
      toast.warning("Silakan pilih jadwal audit terlebih dahulu di tab Jadwal.");
      setActiveTab("jadwal");
      return;
    }
    setScannerActive(true);
    setTimeout(() => {
      try {
        const scanner = new Html5Qrcode("audit-scanner-container");
        scannerRef.current = scanner;

        scanner
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            async (text) => {
              // Stop scanning
              stopScanner();
              // Try to resolve asset ID
              const uuidPattern =
                /\/assets\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
              const match = text.match(uuidPattern);
              const assetId = match && match[1] ? match[1] : text.split("/").pop() || text;

              // Check if asset is inside scope
              const assetObj = assetsInScope.find(
                (a) => a.id === assetId || a.asset_code === assetId,
              );
              if (assetObj) {
                openChecklist(assetObj);
              } else {
                // Try to load asset info anyway from DB
                const { data: dbAsset } = await supabase
                  .from("assets")
                  .select(
                    "id, asset_code, asset_name, location_id, category_id, condition_status, locations(name, room), categories(name)",
                  )
                  .eq("id", assetId)
                  .is("deleted_at", null)
                  .maybeSingle();

                if (dbAsset) {
                  toast.info(
                    `Aset ${dbAsset.asset_code} ditemukan di luar lingkup jadwal. Membuka checklist...`,
                  );
                  openChecklist(dbAsset as unknown as ScopeAssetRow);
                } else {
                  toast.error("Kode QR atau Aset tidak valid.");
                }
              }
            },
            (err) => {},
          )
          .catch((err) => {
            console.error("Audit camera startup error:", err);
            stopScanner();
            const errStr = String(err);
            if (
              errStr.includes("NotReadableError") ||
              errStr.includes("Could not start video source")
            ) {
              toast.error(
                "Kamera sedang digunakan oleh aplikasi lain (seperti Zoom, Discord, OBS, atau browser tab lain). Harap tutup aplikasi tersebut.",
              );
            } else {
              toast.error("Gagal mengakses kamera. Harap pastikan izin kamera telah diberikan.");
            }
          });
      } catch (e) {
        console.error(e);
        toast.error("Gagal mengaktifkan kamera.");
        setScannerActive(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      if (scanner.isScanning) {
        scanner.stop().catch((e) => console.error("Error stopping scanner:", e));
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        if (scanner.isScanning) {
          scanner.stop().catch((e) => console.error("Cleanup stop error:", e));
        }
      }
    };
  }, []);

  const openChecklist = (asset: ScopeAssetRow) => {
    // If already audited, prefill values or let auditor update it
    const existing = auditResults.find((r) => r.asset_id === asset.id);

    setTargetAsset(asset);
    setPhysFound(existing ? existing.physical_found : true);
    setCodeMatch(existing ? existing.code_match : true);
    setLocMatch(existing ? existing.location_match : true);
    setCondMatch(existing ? existing.condition_match : true);
    setAuditStatus(existing ? existing.audit_status : "verified");
    setChecklistNotes(existing ? existing.notes || "" : "");
    setChecklistRecom(existing ? existing.recommendation || "" : "");
    setCreateFinding(false);
    setFindingDesc("");
    setFindingRecom("");
    setChecklistModalOpen(true);
  };

  // Schedule creation Mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof scheduleSchema>) => {
      const { data: auth } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("audit_schedules")
        .insert({
          title: payload.title,
          start_date: payload.start_date,
          end_date: payload.end_date,
          location_id: payload.location_id ? Number(payload.location_id) : null,
          category_id: payload.category_id ? Number(payload.category_id) : null,
          assigned_to: payload.assigned_to || null,
          notes: payload.notes || null,
          created_by: auth.user?.id || null,
          status: "scheduled",
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        action: "CREATE",
        module: "audit",
        tableName: "audit_schedules",
        recordId: data.id,
        description: `Membuat jadwal audit baru: ${payload.title}`,
      });
    },
    onSuccess: () => {
      toast.success("Jadwal audit berhasil dibuat.");
      setScheduleModalOpen(false);

      // Reset form
      setSchedTitle("");
      setSchedLocId("");
      setSchedCatId("");
      setSchedAssignId("");
      setSchedNotes("");

      queryClient.invalidateQueries({ queryKey: ["audit-schedules"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal membuat jadwal.");
    },
  });

  // Checklist Submission Mutation
  const submitChecklistMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof resultSchema>) => {
      if (!selectedSchedId || !targetAsset) {
        throw new Error("Pilih jadwal dan aset audit terlebih dahulu.");
      }
      const { data: auth } = await supabase.auth.getUser();

      // 1. Insert/Update into audit_results
      const existingResult = auditResults.find((r) => r.asset_id === targetAsset.id);
      let resultId = existingResult?.id;

      if (existingResult) {
        const { error: updError } = await supabase
          .from("audit_results")
          .update({
            physical_found: payload.physical_found,
            code_match: payload.code_match,
            location_match: payload.location_match,
            condition_match: payload.condition_match,
            audit_status: payload.audit_status,
            notes: payload.notes || null,
            recommendation: payload.recommendation || null,
          })
          .eq("id", existingResult.id);

        if (updError) throw updError;
      } else {
        const { data: newRes, error: insError } = await supabase
          .from("audit_results")
          .insert({
            audit_schedule_id: selectedSchedId,
            asset_id: targetAsset.id,
            physical_found: payload.physical_found,
            code_match: payload.code_match,
            location_match: payload.location_match,
            condition_match: payload.condition_match,
            audit_status: payload.audit_status,
            notes: payload.notes || null,
            recommendation: payload.recommendation || null,
            auditor_id: auth.user?.id || null,
          })
          .select()
          .single();

        if (insError) throw insError;
        resultId = newRes.id;
      }

      // 2. Create finding if requested or if status is mismatch/damaged
      if (payload.create_finding && resultId) {
        const { error: findError } = await supabase.from("audit_findings").insert({
          audit_result_id: resultId,
          finding_type: payload.finding_type || "kerusakan",
          description: payload.finding_desc || "Temuan fisik tidak sesuai saat audit",
          severity: payload.finding_severity || "medium",
          recommendation: payload.finding_recom || null,
          status: "open",
        });

        if (findError) throw findError;
      }

      // 3. Log Activity
      await logActivity({
        action: "AUDIT",
        module: "audit",
        tableName: "audit_results",
        recordId: resultId,
        description: `Melakukan checklist audit pada aset ${targetAsset.asset_code} (${payload.audit_status})`,
      });
    },
    onSuccess: () => {
      toast.success("Hasil checklist berhasil disimpan.");
      setChecklistModalOpen(false);
      setTargetAsset(null);
      queryClient.invalidateQueries({ queryKey: ["audit-results", selectedSchedId] });
      queryClient.invalidateQueries({ queryKey: ["audit-findings"] });
      queryClient.invalidateQueries({ queryKey: ["audit-schedules"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyimpan checklist.");
    },
  });

  // Resolve finding Mutation
  const resolveFindingMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const { data: auth } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("audit_findings")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: auth.user?.id || null,
        })
        .eq("id", findingId);

      if (error) throw error;

      await logActivity({
        action: "RESOLVE",
        module: "audit",
        tableName: "audit_findings",
        recordId: findingId,
        description: `Menyelesaikan temuan ketidaksesuaian audit`,
      });
    },
    onSuccess: () => {
      toast.success("Status temuan berhasil diubah menjadi resolved.");
      queryClient.invalidateQueries({ queryKey: ["audit-findings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyelesaikan temuan.");
    },
  });

  // Form submit handles
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const parsed = scheduleSchema.safeParse({
      title: schedTitle,
      start_date: schedStartDate,
      end_date: schedEndDate,
      location_id: schedLocId,
      category_id: schedCatId,
      assigned_to: schedAssignId,
      notes: schedNotes,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Form tidak valid.");
      setSubmitLoading(false);
      return;
    }

    createScheduleMutation.mutate(parsed.data, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const handleChecklistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const parsed = resultSchema.safeParse({
      physical_found: physFound,
      code_match: codeMatch,
      location_match: locMatch,
      condition_match: condMatch,
      audit_status: auditStatus,
      notes: checklistNotes,
      recommendation: checklistRecom,
      create_finding: createFinding,
      finding_type: findingType,
      finding_desc: findingDesc,
      finding_severity: findingSeverity,
      finding_recom: findingRecom,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Isian checklist tidak valid.");
      setSubmitLoading(false);
      return;
    }

    submitChecklistMutation.mutate(parsed.data, {
      onSettled: () => setSubmitLoading(false),
    });
  };

  const handleResolve = (id: string) => {
    resolveFindingMutation.mutate(id);
  };

  // Filter lists locally
  const filteredSchedules = schedules.filter((s) => {
    const title = s.title.toLowerCase();
    const query = searchSchedule.toLowerCase();
    return title.includes(query);
  });

  const filteredFindings = findings.filter((f) => {
    const assetName = f.audit_results?.assets?.asset_name?.toLowerCase() || "";
    const type = f.finding_type.toLowerCase();
    const query = searchFinding.toLowerCase();
    return assetName.includes(query) || type.includes(query);
  });

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[500px] grid-cols-3">
          <TabsTrigger value="jadwal">Jadwal Audit</TabsTrigger>
          <TabsTrigger value="scanner">Pemeriksaan / Scan</TabsTrigger>
          <TabsTrigger value="temuan">
            Temuan Audit ({findings.filter((f) => f.status === "open").length})
          </TabsTrigger>
        </TabsList>

        {/* TAB JADWAL AUDIT */}
        <TabsContent value="jadwal" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Kiri: Daftar Jadwal */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari jadwal audit..."
                    className="pl-9"
                    value={searchSchedule}
                    onChange={(e) => setSearchSchedule(e.target.value)}
                  />
                </div>
                {isAuditorOrAdmin && (
                  <Button
                    size="icon"
                    onClick={() => setScheduleModalOpen(true)}
                    className="shrink-0"
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>

              {schedulesPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : filteredSchedules.length === 0 ? (
                <div className="rounded-xl border border-border p-8 text-center text-muted-foreground bg-card">
                  Tidak ada jadwal audit.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredSchedules.map((s) => {
                    const isSelected = selectedSchedId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSchedId(s.id)}
                        className={`group relative flex items-center justify-between rounded-xl border p-4 shadow-[var(--shadow-card)] cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-foreground truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(s.start_date)} - {formatDate(s.end_date)}
                          </p>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {s.locations?.name || "Semua Lokasi"}
                            </Badge>
                            {s.status === "scheduled" && (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px]">
                                Dijadwalkan
                              </Badge>
                            )}
                            {s.status === "in_progress" && (
                              <Badge className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px]">
                                Berjalan
                              </Badge>
                            )}
                            {s.status === "completed" && (
                              <Badge className="bg-success-soft text-success border border-success-soft text-[10px]">
                                Selesai
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kanan: Detail Jadwal terpilih */}
            <div className="lg:col-span-2">
              {selectedSchedule ? (
                <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {selectedSchedule.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Auditor: {selectedSchedule.assigned_user?.full_name || "Belum ditugaskan"}
                      </p>
                    </div>
                    {isAuditorOrAdmin && selectedSchedule.status !== "completed" && (
                      <Button onClick={() => setActiveTab("scanner")}>
                        <Camera className="size-4" /> Mulai Scan Audit
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="text-muted-foreground text-xs font-semibold leading-none">
                        Cakupan Lokasi
                      </p>
                      <p className="font-semibold text-foreground mt-1.5 leading-tight">
                        {selectedSchedule.locations?.name || "Semua Lokasi"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="text-muted-foreground text-xs font-semibold leading-none">
                        Cakupan Kategori
                      </p>
                      <p className="font-semibold text-foreground mt-1.5 leading-tight">
                        {selectedSchedule.categories?.name || "Semua Kategori"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="text-muted-foreground text-xs font-semibold leading-none">
                        Kemajuan Pemeriksaan
                      </p>
                      <p className="font-bold text-blue-600 mt-1.5 leading-none">
                        {auditResults.length} / {assetsInScope.length} Aset
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground">
                        Daftar Aset untuk Diperiksa
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        Pilih baris untuk checklist manual
                      </span>
                    </div>

                    {assetsPending || resultsPending ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : assetsInScope.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                        Tidak ada aset yang sesuai dalam ruang lingkup audit ini.
                      </p>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kode / Nama Aset</TableHead>
                              <TableHead>Lokasi Asal</TableHead>
                              <TableHead>Status Audit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assetsInScope.map((asset) => {
                              const result = auditResults.find((r) => r.asset_id === asset.id);
                              return (
                                <TableRow
                                  key={asset.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => openChecklist(asset)}
                                >
                                  <TableCell>
                                    <p className="font-mono text-xs font-bold text-muted-foreground">
                                      {asset.asset_code}
                                    </p>
                                    <p className="font-semibold text-foreground truncate max-w-[150px] mt-0.5">
                                      {asset.asset_name}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-sm text-foreground">
                                    {asset.locations?.name || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {result ? (
                                      <div className="flex flex-col gap-1 items-start">
                                        <Badge className="bg-success-soft text-success border-success-soft text-[10px] px-1.5 py-0">
                                          Telah Diperiksa
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                          {result.audit_status}
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-muted-foreground text-[10px]"
                                      >
                                        Belum Diperiksa
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)] flex flex-col items-center justify-center h-full min-h-[350px]">
                  <ClipboardList className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-foreground">Pilih Jadwal Audit</p>
                  <p className="text-sm mt-1 max-w-xs">
                    Pilih salah satu jadwal audit dari panel kiri untuk melihat cakupan aset dan
                    memulai pemeriksaan fisik.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB SCANNER PEMERIKSAAN */}
        <TabsContent value="scanner" className="mt-6">
          <div className="max-w-md mx-auto space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] text-center space-y-6 overflow-hidden relative">
              {!scannerActive && (
                <div className="py-10 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Camera className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Scan Pemeriksaan Audit</h3>
                    <p className="text-sm text-muted-foreground max-w-[300px] mx-auto">
                      Jadwal Aktif:{" "}
                      <span className="font-semibold text-foreground">
                        {selectedSchedule?.title || "Belum dipilih"}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={startScanner}
                    size="lg"
                    className="w-full max-w-[200px]"
                    disabled={!selectedSchedId}
                  >
                    Mulai Pindai
                  </Button>
                </div>
              )}

              {scannerActive && (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-square max-w-[320px] mx-auto">
                    <div id="audit-scanner-container" className="w-full h-full" />

                    <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40">
                      <div className="absolute left-[15%] right-[15%] top-[15%] bottom-[15%] border-2 border-primary/80 rounded">
                        <div className="w-full h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] absolute top-0 left-0 animate-[scanLaser_2.5s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Arahkan kamera ke QR Code label fisik aset.
                  </p>

                  <Button onClick={stopScanner} variant="outline" className="w-full max-w-[150px]">
                    <CameraOff className="size-4" /> Hentikan Kamera
                  </Button>
                </div>
              )}
            </div>

            <style
              dangerouslySetInnerHTML={{
                __html: `
              #audit-scanner-container { border: none !important; }
              #audit-scanner-container__dashboard { padding: 10px !important; background: transparent !important; }
              #audit-scanner-container__camera_selection {
                background-color: var(--secondary) !important;
                color: var(--secondary-foreground) !important;
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
                font-size: 14px !important;
                padding: 8px 16px !important;
                border: none !important;
              }
            `,
              }}
            />
          </div>
        </TabsContent>

        {/* TAB TEMUAN AUDIT (FINDINGS) */}
        <TabsContent value="temuan" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari temuan atau nama aset..."
                className="pl-9"
                value={searchFinding}
                onChange={(e) => setSearchFinding(e.target.value)}
              />
            </div>
          </div>

          {findingsPending ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
              <CheckSquare className="mx-auto size-12 text-muted-foreground/60 mb-3" />
              <p className="font-semibold text-foreground">Tidak ada temuan audit aktif</p>
              <p className="text-sm mt-1">
                Luar biasa! Tidak ada ketidaksesuaian atau semua telah diselesaikan.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aset & Jadwal</TableHead>
                    <TableHead>Jenis Temuan / Deskripsi</TableHead>
                    <TableHead>Keparahan</TableHead>
                    <TableHead>Status / Penyelesaian</TableHead>
                    {isAuditorOrAdmin && (
                      <TableHead className="w-[120px] text-center">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-muted-foreground">
                            {f.audit_results?.assets?.asset_code}
                          </p>
                          <p className="font-semibold text-foreground truncate max-w-xs mt-0.5">
                            {f.audit_results?.assets?.asset_name}
                          </p>
                          <p className="text-xs text-blue-500/80 truncate mt-1">
                            {f.audit_results?.audit_schedules?.title}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-sm">
                          <Badge
                            variant="secondary"
                            className="capitalize text-[10px] py-0 px-1.5 mb-1 bg-muted"
                          >
                            {f.finding_type.replace("_", " ")}
                          </Badge>
                          <p className="text-foreground font-medium">{f.description}</p>
                          {f.recommendation && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Rekomendasi: {f.recommendation}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {f.severity === "high" && (
                          <Badge variant="destructive" className="capitalize text-[10px]">
                            Tinggi
                          </Badge>
                        )}
                        {f.severity === "medium" && (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px] capitalize">
                            Sedang
                          </Badge>
                        )}
                        {f.severity === "low" && (
                          <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] capitalize">
                            Rendah
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.status === "resolved" ? (
                          <div>
                            <Badge className="bg-success-soft text-success border-success-soft text-[10px]">
                              Diselesaikan
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Oleh: {f.resolved_user?.full_name || "-"}
                            </p>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-500/5 text-red-500 border-red-500/20 text-[10px]"
                          >
                            Belum Selesai
                          </Badge>
                        )}
                      </TableCell>
                      {isAuditorOrAdmin && (
                        <TableCell className="text-center">
                          {f.status === "open" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs font-semibold"
                              onClick={() => handleResolve(f.id)}
                            >
                              Selesaikan
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">-</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIALOG BUAT JADWAL AUDIT */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleScheduleSubmit}>
            <DialogHeader>
              <DialogTitle>Buat Jadwal Audit Baru</DialogTitle>
              <DialogDescription>
                Tentukan cakupan lokasi atau kategori untuk pemeriksaan aset terprogram.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched_title">Judul Audit *</Label>
                <Input
                  id="sched_title"
                  placeholder="Contoh: Audit Semester 1 Lab Komputer"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sched_start">Tanggal Mulai *</Label>
                  <Input
                    id="sched_start"
                    type="date"
                    value={schedStartDate}
                    onChange={(e) => setSchedStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sched_end">Tanggal Selesai *</Label>
                  <Input
                    id="sched_end"
                    type="date"
                    value={schedEndDate}
                    onChange={(e) => setSchedEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sched_loc">Cakupan Lokasi</Label>
                  <Select value={schedLocId} onValueChange={setSchedLocId}>
                    <SelectTrigger id="sched_loc">
                      <SelectValue placeholder="Semua Lokasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Lokasi</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name} {l.room ? `| ${l.room}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sched_cat">Cakupan Kategori</Label>
                  <Select value={schedCatId} onValueChange={setSchedCatId}>
                    <SelectTrigger id="sched_cat">
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sched_assign">Auditor Penanggung Jawab</Label>
                <Select value={schedAssignId} onValueChange={setSchedAssignId}>
                  <SelectTrigger id="sched_assign">
                    <SelectValue placeholder="Pilih Auditor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sched_notes">Catatan Tambahan</Label>
                <Textarea
                  id="sched_notes"
                  placeholder="Instruksi tambahan bagi auditor..."
                  rows={2}
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleModalOpen(false)}
                disabled={submitLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  "Buat Jadwal"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG FORM CHECKLIST AUDIT */}
      <Dialog open={checklistModalOpen} onOpenChange={setChecklistModalOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto pr-2">
          <form onSubmit={handleChecklistSubmit}>
            <DialogHeader>
              <DialogTitle>Checklist Hasil Pemeriksaan</DialogTitle>
              <DialogDescription>
                Validasi kecocokan fisik aset yang sedang diperiksa.
              </DialogDescription>
            </DialogHeader>

            {targetAsset && (
              <div className="bg-muted rounded-xl p-3 text-sm flex items-center justify-between mt-3">
                <div>
                  <p className="font-mono text-xs font-extrabold text-muted-foreground">
                    {targetAsset.asset_code}
                  </p>
                  <p className="font-bold text-foreground mt-0.5 leading-none">
                    {targetAsset.asset_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Kondisi Sistem</p>
                  <Badge variant="outline" className="mt-1 capitalize text-[10px]">
                    {targetAsset.condition_status}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-2.5">
                <Label>Pernyataan Kesesuaian Fisik</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card hover:bg-muted/30">
                    <Checkbox
                      id="phys_found"
                      checked={physFound}
                      onCheckedChange={(val) => setPhysFound(!!val)}
                    />
                    <Label htmlFor="phys_found" className="text-xs font-semibold cursor-pointer">
                      Fisik Aset Ada
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card hover:bg-muted/30">
                    <Checkbox
                      id="code_match"
                      checked={codeMatch}
                      onCheckedChange={(val) => setCodeMatch(!!val)}
                    />
                    <Label htmlFor="code_match" className="text-xs font-semibold cursor-pointer">
                      Kode Aset Sesuai
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card hover:bg-muted/30">
                    <Checkbox
                      id="loc_match"
                      checked={locMatch}
                      onCheckedChange={(val) => setLocMatch(!!val)}
                    />
                    <Label htmlFor="loc_match" className="text-xs font-semibold cursor-pointer">
                      Lokasi Sesuai
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card hover:bg-muted/30">
                    <Checkbox
                      id="cond_match"
                      checked={condMatch}
                      onCheckedChange={(val) => setCondMatch(!!val)}
                    />
                    <Label htmlFor="cond_match" className="text-xs font-semibold cursor-pointer">
                      Kondisi Sesuai
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="audit_status">Status Verifikasi Audit *</Label>
                <Select value={auditStatus} onValueChange={setAuditStatus}>
                  <SelectTrigger id="audit_status">
                    <SelectValue placeholder="Pilih Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified (Sesuai & Ada)</SelectItem>
                    <SelectItem value="mismatch">Mismatch (Ada Perbedaan Data)</SelectItem>
                    <SelectItem value="missing">Missing (Aset Tidak Ditemukan / Hilang)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="chk_notes">Catatan Temuan</Label>
                  <Input
                    id="chk_notes"
                    placeholder="Contoh: Aset diletakkan di lemari B"
                    value={checklistNotes}
                    onChange={(e) => setChecklistNotes(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chk_recom">Rekomendasi Tindak Lanjut</Label>
                  <Input
                    id="chk_recom"
                    placeholder="Contoh: Mutasikan lokasi di sistem"
                    value={checklistRecom}
                    onChange={(e) => setChecklistRecom(e.target.value)}
                  />
                </div>
              </div>

              {/* CHECKBOX CATAT TEMUAN (DISCREPANCY) */}
              <div className="flex items-center space-x-2 border border-dashed border-yellow-500/40 rounded-lg p-3 bg-yellow-500/5">
                <Checkbox
                  id="create_finding"
                  checked={createFinding}
                  onCheckedChange={(val) => setCreateFinding(!!val)}
                />
                <Label
                  htmlFor="create_finding"
                  className="text-xs font-semibold text-yellow-600 flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="size-3.5" /> Catat sebagai Temuan Audit (Finding)?
                </Label>
              </div>

              {createFinding && (
                <div className="rounded-xl border border-border p-4 bg-muted/40 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="f_type">Jenis Temuan</Label>
                      <Select value={findingType} onValueChange={setFindingType}>
                        <SelectTrigger id="f_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kerusakan">Kerusakan Fisik</SelectItem>
                          <SelectItem value="hilang">Aset Hilang</SelectItem>
                          <SelectItem value="salah_lokasi">Salah Penempatan Lokasi</SelectItem>
                          <SelectItem value="lainnya">Lainnya / Tidak Cocok</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="f_severity">Tingkat Keparahan</Label>
                      <Select value={findingSeverity} onValueChange={setFindingSeverity}>
                        <SelectTrigger id="f_severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Rendah (Minor)</SelectItem>
                          <SelectItem value="medium">Sedang (Moderate)</SelectItem>
                          <SelectItem value="high">Tinggi (Critical)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="f_desc">Deskripsi Temuan *</Label>
                    <Input
                      id="f_desc"
                      placeholder="Masukkan detail kendala yang ditemukan..."
                      value={findingDesc}
                      onChange={(e) => setFindingDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="f_recom">Rekomendasi Penyelesaian</Label>
                    <Input
                      id="f_recom"
                      placeholder="Langkah perbaikan / investigasi..."
                      value={findingRecom}
                      onChange={(e) => setFindingRecom(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChecklistModalOpen(false)}
                disabled={submitLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  "Simpan Pemeriksaan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
