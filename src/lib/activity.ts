import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  action: string;
  module: string;
  tableName?: string | null | undefined;
  recordId?: string | null | undefined;
  description: string;
  oldData?: unknown;
  newData?: unknown;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("activity_logs").insert({
    user_id: auth.user.id,
    action: params.action,
    module: params.module,
    table_name: params.tableName ?? null,
    record_id: params.recordId ?? null,
    description: params.description,
    old_data: (params.oldData ?? null) as never,
    new_data: (params.newData ?? null) as never,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}
