import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canAccess, type ModuleKey } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

export function ModuleGuard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!canAccess(user?.role ?? null, module)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Akses ditolak</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peran Anda tidak memiliki izin untuk membuka halaman ini.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
