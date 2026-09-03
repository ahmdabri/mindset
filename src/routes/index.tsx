import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

function RootAuthGate() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          navigate({ to: "/login", replace: true });
          return;
        }

        navigate({ to: "/dashboard", replace: true });
      } catch {
        if (active) {
          navigate({ to: "/login", replace: true });
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!checking) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6faff] text-[#002678]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin" />
        <p className="text-sm font-medium tracking-[0.2em] text-slate-600 uppercase">
          Loading
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: RootAuthGate,
});
