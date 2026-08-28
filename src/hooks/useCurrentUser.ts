import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  status: string;
  role: AppRole | null;
}

export const currentUserQueryKey = ["current-user"] as const;

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, full_name, email, phone, photo, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    username: profile?.username ?? user.email?.split("@")[0] ?? "user",
    fullName: profile?.full_name ?? user.email ?? "Pengguna",
    email: profile?.email ?? user.email ?? null,
    phone: profile?.phone ?? null,
    photo: profile?.photo ?? null,
    status: profile?.status ?? "active",
    role: (roleRow?.role as AppRole | undefined) ?? null,
  };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });
}
