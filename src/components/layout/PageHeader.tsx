import { Construction } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ModulePlaceholder({ phase }: { phase: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <Construction className="mx-auto size-9 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Modul ini dibangun pada {phase}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Struktur database, hak akses, dan navigasi untuk modul ini sudah siap.
      </p>
    </div>
  );
}
