import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, CheckCircle2, AlertTriangle, HandCoins, Wrench, HelpCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - MINDSET Diskominfo" },
      {
        name: "description",
        content: "Ringkasan kondisi, status, dan aktivitas aset Diskominfo secara real-time.",
      },
      { property: "og:title", content: "Dashboard - MINDSET Diskominfo" },
      {
        property: "og:description",
        content: "Ringkasan kondisi, status, dan aktivitas aset Diskominfo.",
      },
    ],
  }),
  component: DashboardRoute,
});

interface AssetRow {
  acquisition_date: string;
  acquisition_price: number;
  condition_status: string;
  asset_status: string;
  category_id: number;
}

interface DashboardData {
  assets: AssetRow[];
  categories: { id: number; name: string }[];
  logs: {
    id: string;
    action: string;
    module: string;
    description: string | null;
    created_at: string;
  }[];
}

async function fetchDashboard(): Promise<DashboardData> {
  const [assetsRes, categoriesRes, logsRes] = await Promise.all([
    supabase
      .from("assets")
      .select("acquisition_date, acquisition_price, condition_status, asset_status, category_id")
      .is("deleted_at", null),
    supabase.from("categories").select("id, name"),
    supabase
      .from("activity_logs")
      .select("id, action, module, description, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (assetsRes.error) throw assetsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (logsRes.error) throw logsRes.error;

  return {
    assets: (assetsRes.data ?? []) as AssetRow[],
    categories: categoriesRes.data ?? [],
    logs: logsRes.data ?? [],
  };
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function DashboardRoute() {
  return (
    <ModuleGuard module="dashboard">
      <Dashboard />
    </ModuleGuard>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  tone: string;
}) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data: user } = useCurrentUser();
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-destructive">
          Gagal memuat data dashboard. Silakan muat ulang halaman.
        </CardContent>
      </Card>
    );
  }

  const assets = data.assets;
  const total = assets.length;
  const baik = assets.filter((a) => a.condition_status === "baik").length;
  const rusak = assets.filter((a) =>
    ["rusak_ringan", "rusak_berat"].includes(a.condition_status),
  ).length;
  const dipinjam = assets.filter((a) => a.asset_status === "dipinjam").length;
  const maintenance = assets.filter((a) => a.asset_status === "maintenance").length;
  const hilang = assets.filter((a) => a.condition_status === "hilang").length;
  const nilaiTotal = assets.reduce((sum, a) => sum + Number(a.acquisition_price ?? 0), 0);

  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), 11 - i)));
  const trend = months.map((month) => ({
    label: format(month, "MMM yy", { locale: localeId }),
    jumlah: assets.filter((a) => {
      if (!a.acquisition_date) return false;
      try {
        const date = startOfMonth(parseISO(a.acquisition_date));
        return date.getTime() === month.getTime();
      } catch (e) {
        return false;
      }
    }).length,
  }));

  const conditionData = [
    { name: "Baik", value: assets.filter((a) => a.condition_status === "baik").length },
    {
      name: "Rusak Ringan",
      value: assets.filter((a) => a.condition_status === "rusak_ringan").length,
    },
    {
      name: "Rusak Berat",
      value: assets.filter((a) => a.condition_status === "rusak_berat").length,
    },
    { name: "Hilang", value: hilang },
  ].filter((entry) => entry.value > 0);

  const categoryData = data.categories
    .map((category) => ({
      name: category.name,
      jumlah: assets.filter((a) => a.category_id === category.id).length,
    }))
    .filter((entry) => entry.jumlah > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
            Haii, {user?.fullName ?? "Pengguna"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selamat datang di MINDSET - Manajemen Informasi Data Aset
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Nilai aset: {rupiah(nilaiTotal)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Aset" value={total} icon={Package} tone="bg-accent text-primary" />
        <StatCard
          label="Aset Kondisi Baik"
          value={baik}
          icon={CheckCircle2}
          tone="bg-success/10 text-success"
        />
        <StatCard
          label="Aset Rusak"
          value={rusak}
          icon={AlertTriangle}
          tone="bg-destructive/10 text-destructive"
        />
        <StatCard
          label="Aset Dipinjam"
          value={dipinjam}
          icon={HandCoins}
          tone="bg-info/10 text-info"
        />
        <StatCard
          label="Aset Maintenance"
          value={maintenance}
          icon={Wrench}
          tone="bg-warning/15 text-warning"
        />
        <StatCard
          label="Aset Hilang"
          value={hilang}
          icon={HelpCircle}
          tone="bg-muted text-muted-foreground"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Tren Aset Masuk (12 bulan terakhir)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {total === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="jumlah"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-chart-1)"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Kondisi Aset</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {conditionData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={conditionData} dataKey="value" nameKey="name" innerRadius={45}>
                    {conditionData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Distribusi Aset per Kategori</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {categoryData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {data.logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada aktivitas tercatat.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.logs.map((log) => (
                  <li key={log.id} className="flex gap-3 border-b border-border pb-3 last:border-0">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {log.description ?? `${log.action} • ${log.module}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.created_at
                          ? format(parseISO(log.created_at), "dd MMM yyyy HH:mm", {
                              locale: localeId,
                            })
                          : "-"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Belum ada data aset.
    </div>
  );
}
