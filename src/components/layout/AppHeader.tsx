import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Settings, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { NotificationBell } from "./NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL } from "@/lib/permissions";
import type { CurrentUser } from "@/hooks/useCurrentUser";

const SEGMENT_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  assets: "Data Aset",
  categories: "Kategori",
  locations: "Lokasi",
  qr: "QR Code",
  scan: "Scan QR",
  mutations: "Mutasi",
  loans: "Peminjaman",
  maintenance: "Maintenance",
  audit: "Audit",
  reports: "Laporan",
  "activity-logs": "History",
  users: "Manajemen Pengguna",
  settings: "Pengaturan",
  create: "Tambah",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AppHeader({ user }: { user: CurrentUser | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Anda telah keluar dari MINDSET.");
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">
            MINDSET
          </Link>
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`}>
              <span className="px-1.5">/</span>
              <span className={index === segments.length - 1 ? "font-medium text-foreground" : ""}>
                {SEGMENT_LABEL[segment] ?? segment}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationBell user={user} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials(user?.fullName ?? "SM")}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-sm font-medium leading-tight">
                  {user?.fullName ?? "Pengguna"}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {user?.role ? ROLE_LABEL[user.role] : "Tanpa peran"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email ?? "-"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <UserIcon className="mr-2 size-4" /> Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 size-4" /> Pengaturan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 size-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
