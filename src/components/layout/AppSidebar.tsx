import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Tags,
  MapPin,
  QrCode,
  ScanLine,
  ArrowLeftRight,
  HandCoins,
  Wrench,
  ClipboardCheck,
  FileBarChart,
  History,
  Users,
  Settings,
  Briefcase,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { canAccess, type AppRole, type ModuleKey } from "@/lib/permissions";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  module: ModuleKey;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Data Aset", url: "/assets", icon: Package, module: "assets" },
      { title: "Kategori", url: "/categories", icon: Tags, module: "categories" },
      { title: "Lokasi", url: "/locations", icon: MapPin, module: "locations" },
      { title: "Penyedia", url: "/vendors", icon: Building2, module: "vendors" },
      { title: "Jenis Pekerjaan", url: "/work-types", icon: Briefcase, module: "work-types" },
    ],
  },
  {
    label: "Identifikasi",
    items: [
      { title: "QR Code", url: "/qr", icon: QrCode, module: "qr" },
      { title: "Scan QR", url: "/scan", icon: ScanLine, module: "scan" },
    ],
  },
  {
    label: "Transaksi",
    items: [
      {
        title: "Barang Masuk",
        url: "/transactions/in",
        icon: ArrowDownToLine,
        module: "transactions-in",
      },
      {
        title: "Barang Keluar",
        url: "/transactions/out",
        icon: ArrowUpFromLine,
        module: "transactions-out",
      },
      { title: "Maintenance", url: "/maintenance", icon: Wrench, module: "maintenance" },
    ],
  },
  {
    label: "Pengawasan",
    items: [
      { title: "Audit", url: "/audit", icon: ClipboardCheck, module: "audit" },
      { title: "Laporan", url: "/reports", icon: FileBarChart, module: "reports" },
      { title: "History", url: "/activity-logs", icon: History, module: "activity-logs" },
    ],
  },
  {
    label: "Administrasi",
    items: [
      { title: "Manajemen Pengguna", url: "/users", icon: Users, module: "users" },
      { title: "Pengaturan", url: "/settings", icon: Settings, module: "settings" },
    ],
  },
];

export function AppSidebar({ role }: { role: AppRole | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo minset.png"
            alt="Logo MINDSET"
            className="size-9 shrink-0 rounded-lg bg-sidebar-accent/80 p-1.5 shadow-sm"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-extrabold tracking-wider text-sidebar-foreground">
              MINDSET
            </p>
            <p className="truncate text-[10px] font-medium leading-tight text-sidebar-foreground/75">
              Manajemen Informasi Data Aset
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => canAccess(role, item.module));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label ?? "main"}>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                      >
                        <Link to={item.url}>
                          <item.icon className="size-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
