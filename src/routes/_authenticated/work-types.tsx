import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, Briefcase } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
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
import { WorkTypeFormDialog } from "@/components/work-types/WorkTypeFormDialog";

export interface WorkType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: string;
}

export const Route = createFileRoute("/_authenticated/work-types")({
  head: () => ({
    meta: [
      { title: "Jenis Pekerjaan - MINDSET Diskominfo" },
      { name: "description", content: "Kelola referensi jenis pekerjaan." },
    ],
  }),
  component: Page,
});

function Page() {
  const [search, setSearch] = useState("");
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | undefined>(undefined);

  async function fetchWorkTypes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("work_types")
        .select("*")
        .order("code", { ascending: true });

      if (error) throw error;
      setWorkTypes((data as unknown as WorkType[]) || []);
    } catch (err) {
      console.error("Gagal mengambil data jenis pekerjaan:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkTypes();
  }, []);

  const filteredData = workTypes.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ModuleGuard module="work-types">
      <div className="space-y-6">
        <PageHeader 
          title="Jenis Pekerjaan" 
          description="Referensi jenis-jenis pengadaan atau mutasi aset" 
          actions={
            <Button
              onClick={() => {
                setSelectedWorkType(undefined);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Pekerjaan
            </Button>
          }
        />
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Cari kode atau nama pekerjaan..." 
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
                <TableHead className="font-semibold text-xs text-muted-foreground w-24">KODE</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">NAMA PEKERJAAN</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">DESKRIPSI</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">STATUS</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-4 rounded-full" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((wt) => (
                  <TableRow key={wt.id}>
                    <TableCell className="font-bold text-sm text-primary">{wt.code}</TableCell>
                    <TableCell className="font-bold text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Briefcase className="size-4 text-primary" />
                        {wt.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {wt.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={
                          wt.status === 'active' 
                            ? "bg-green-100 text-green-800 border-transparent hover:bg-green-200"
                            : "bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200"
                        }
                      >
                        {wt.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setSelectedWorkType(wt);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Tidak ada referensi jenis pekerjaan ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <WorkTypeFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedWorkType}
        onSuccess={fetchWorkTypes}
      />
    </ModuleGuard>
  );
}
