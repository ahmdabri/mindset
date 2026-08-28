import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil Pengguna - MINDSET Diskominfo" },
      { name: "description", content: "Informasi profil pengguna." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useCurrentUser();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Profil Pengguna" description="Lihat detail informasi akun Anda" />

      <Card>
        <CardHeader>
          <CardTitle>Informasi Akun</CardTitle>
          <CardDescription>
            Detail akun MINDSET Anda. Hubungi administrator jika terdapat kesalahan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nama Lengkap</Label>
              <div className="font-medium text-lg">{user?.fullName ?? "-"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Email</Label>
              <div className="font-medium text-lg">{user?.email ?? "-"}</div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Peran / Hak Akses</Label>
              <div className="font-medium text-lg">
                {user?.role ? ROLE_LABEL[user.role] : "Tanpa peran"}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Username</Label>
              <div className="font-medium text-lg">{user?.username ?? "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
