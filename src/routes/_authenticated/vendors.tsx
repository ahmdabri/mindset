import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Edit, Trash2, Building2, MapPin, Phone, Mail } from "lucide-react";

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
import { VendorFormDialog } from "@/components/vendors/VendorFormDialog";

export interface Vendor {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({
    meta: [
      { title: "Penyedia Barang - MINDSET Diskominfo" },
      { name: "description", content: "Kelola data penyedia barang / vendor." },
    ],
  }),
  component: Page,
});

function Page() {
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>(undefined);

  async function fetchVendors() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setVendors(data as Vendor[]);
    } catch (err) {
      console.error("Gagal mengambil data penyedia:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVendors();
  }, []);

  const filteredData = vendors.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.email && item.email.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <ModuleGuard module="vendors">
      <div className="space-y-6">
        <PageHeader
          title="Penyedia Barang"
          description="Daftar penyedia pengadaan aset atau layanan"
          actions={
            <Button
              onClick={() => {
                setSelectedVendor(undefined);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Tambah Penyedia
            </Button>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama penyedia atau email..."
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
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  NAMA PENYEDIA
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  KONTAK
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground">
                  ALAMAT
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">
                  STATUS
                </TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground text-center w-24">
                  AKSI
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-16 mx-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-bold text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-primary" />
                        {vendor.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {vendor.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3" />
                            {vendor.phone}
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3" />
                            {vendor.email}
                          </div>
                        )}
                        {!vendor.phone && !vendor.email && <span>-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="size-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-2 max-w-sm">{vendor.address || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={
                          vendor.status === "active"
                            ? "bg-green-100 text-green-800 border-transparent hover:bg-green-200"
                            : "bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200"
                        }
                      >
                        {vendor.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Tidak ada penyedia ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <VendorFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={selectedVendor}
        onSuccess={fetchVendors}
      />
    </ModuleGuard>
  );
}
