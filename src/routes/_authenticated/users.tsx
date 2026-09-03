import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, KeyRound, ShieldAlert, Shield } from "lucide-react";
import { toast } from "sonner";

import { logActivity } from "@/lib/activity";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, AppRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resetUserPassword, updateUserRole } from "@/actions/users";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Manajemen Pengguna - MINDSET Diskominfo" },
      { name: "description", content: "Kelola akun dan peran pegawai." },
    ],
  }),
  component: Page,
});

type UserData = {
  id: string;
  email: string;
  full_name: string;
  username: string;
  role: AppRole | null;
};

function Page() {
  const queryClient = useQueryClient();
  const [resetPwdUser, setResetPwdUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [editRoleUser, setEditRoleUser] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState<AppRole | "">("");

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: usersData, error: usersError }, { data: rolesData, error: rolesError }] =
        await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("user_roles").select("user_id, role"),
        ]);

      if (usersError) {
        console.error("Supabase Error fetching users:", usersError);
        throw usersError;
      }
      if (rolesError) {
        console.error("Supabase Error fetching user roles:", rolesError);
        throw rolesError;
      }

      let fetchedUsers = (usersData || []) as Record<string, unknown>[];
      const rolesByUserId = new Map(
        (rolesData || []).map((userRole) => [userRole.user_id, userRole.role as AppRole]),
      );

      // Fallback: Jika kosong (kemungkinan karena trigger belum jalan), tambahkan diri sendiri secara lokal
      if (fetchedUsers.length === 0) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const selfUser = {
            id: authData.user.id,
            email: authData.user.email ?? null,
            full_name:
              (authData.user.user_metadata?.["full_name"] as string) ||
              authData.user.email ||
              "Pengguna",
            username:
              (authData.user.user_metadata?.["username"] as string) ||
              authData.user.email?.split("@")[0] ||
              "user",
            role: "admin_utama",
          };

          // Cobalah untuk insert ke database (Self-heal)
          await supabase
            .from("users")
            .insert({
              id: selfUser.id,
              email: selfUser.email,
              full_name: selfUser.full_name,
              username: selfUser.username,
            })
            .select()
            .maybeSingle();

          fetchedUsers = [selfUser];
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return fetchedUsers.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        username: u.username,
        role: (u.role as AppRole | undefined) ?? rolesByUserId.get(u.id as string) ?? null,
      })) as UserData[];
    },
  });

  if (isError) {
    console.error("React Query Error:", error);
  }

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resetPwdUser || !newPassword || !confirmPassword) throw new Error("Data tidak lengkap");
      if (newPassword !== confirmPassword)
        throw new Error("Password dan konfirmasi password tidak cocok.");
      return resetUserPassword({ data: { userId: resetPwdUser.id, newPassword } });
    },
    onSuccess: async () => {
      toast.success("Password berhasil direset.");
      if (resetPwdUser) {
        await logActivity({
          action: "UPDATE",
          module: "users",
          recordId: resetPwdUser.id,
          description: `Reset password untuk pengguna ${resetPwdUser.full_name}`,
        });
      }
      setResetPwdUser(null);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(`Gagal mereset password: ${error.message}`);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      if (!editRoleUser || !newRole) throw new Error("Data tidak lengkap");
      return updateUserRole({
        data: {
          userId: editRoleUser.id,
          role: newRole as AppRole,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Peran pengguna berhasil diperbarui.");
      if (editRoleUser) {
        await logActivity({
          action: "UPDATE",
          module: "users",
          recordId: editRoleUser.id,
          description: `Ubah peran untuk pengguna ${editRoleUser.full_name} menjadi ${newRole}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditRoleUser(null);
      setNewRole("");
    },
    onError: (error) => {
      toast.error(`Gagal memperbarui peran: ${error.message}`);
    },
  });

  return (
    <ModuleGuard module="users">
      <div className="space-y-6">
        <PageHeader title="Manajemen Pengguna" description="Kelola akun dan peran pegawai" />

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead className="w-25"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Memuat data pengguna...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-red-500">
                    Gagal memuat data pengguna: {error?.message}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Tidak ada data pengguna.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role ? ROLE_LABEL[u.role] : "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Buka menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditRoleUser(u);
                              setNewRole(u.role ?? "");
                            }}
                          >
                            <Shield className="mr-2 h-4 w-4" /> Ubah Peran
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetPwdUser(u)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dialog Reset Password */}
        <Dialog open={!!resetPwdUser} onOpenChange={(open) => !open && setResetPwdUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Anda akan mengganti password untuk pengguna <b>{resetPwdUser?.full_name}</b>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Password Baru</Label>
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPwdUser(null)}>
                Batal
              </Button>
              <Button
                onClick={() => resetPasswordMutation.mutate()}
                disabled={!newPassword || !confirmPassword || resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "Menyimpan..." : "Simpan Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Ubah Peran */}
        <Dialog open={!!editRoleUser} onOpenChange={(open) => !open && setEditRoleUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Peran Pengguna</DialogTitle>
              <DialogDescription>
                Tentukan hak akses untuk pengguna <b>{editRoleUser?.full_name}</b>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Peran (Role)</Label>
                <Select value={newRole} onValueChange={setNewRole as (value: AppRole | "") => void}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih peran..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRoleUser(null)}>
                Batal
              </Button>
              <Button
                onClick={() => updateRoleMutation.mutate()}
                disabled={!newRole || updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? "Menyimpan..." : "Simpan Peran"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGuard>
  );
}
