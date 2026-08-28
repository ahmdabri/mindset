import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Clock, User, Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/activity-logs")({
  head: () => ({
    meta: [
      { title: "History / Activity Log - Mindset Diskominfo" },
      { name: "description", content: "Seluruh aktivitas penting pengguna sistem." },
      { property: "og:title", content: "History / Activity Log - Mindset Diskominfo" },
      { property: "og:description", content: "Seluruh aktivitas penting pengguna sistem." },
    ],
  }),
  component: Page,
});

type ActivityLog = {
  id: string;
  action: string;
  module: string;
  description: string | null;
  created_at: string;
  users: {
    full_name: string;
  } | null;
};

function Page() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("activity_logs")
          .select(
            `
            id,
            action,
            module,
            description,
            created_at,
            users ( full_name )
          `,
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setLogs(data as ActivityLog[]);
      } catch (err) {
        console.error("Gagal mengambil log aktivitas:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.module.toLowerCase().includes(q) ||
      (log.description && log.description.toLowerCase().includes(q)) ||
      (log.users && log.users.full_name.toLowerCase().includes(q))
    );
  });

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("create") || a.includes("insert") || a.includes("masuk") || a.includes("tambah"))
      return "bg-green-100 text-green-800 border-green-200";
    if (a.includes("update") || a.includes("edit") || a.includes("mutasi"))
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (a.includes("delete") || a.includes("remove") || a.includes("keluar") || a.includes("hapus"))
      return "bg-red-100 text-red-800 border-red-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <ModuleGuard module="activity-logs">
      <div className="space-y-6">
        <PageHeader
          title="History / Activity Log"
          description="Seluruh aktivitas penting pengguna sistem"
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari aksi, modul, pengguna, atau deskripsi..."
              className="pl-9 h-11 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-xs text-muted-foreground w-48">
                  WAKTU
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-48">
                  PENGGUNA
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-32">
                  MODUL
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground w-32">
                  AKSI
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  DESKRIPSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="size-3 text-muted-foreground" />
                        {new Date(log.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="size-3 text-muted-foreground" />
                        {log.users?.full_name || "Sistem"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Activity className="size-3 text-muted-foreground" />
                        <span className="capitalize">{log.module.replace(/-/g, " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-semibold capitalize ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.description || "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Tidak ada aktivitas yang ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ModuleGuard>
  );
}
