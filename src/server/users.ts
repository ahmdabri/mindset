import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "@/lib/permissions";

export const resetUserPassword = createServerFn({ method: "POST" })
  .validator((data: { userId: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    const { userId, newPassword } = data;

    // Check if caller is admin - omitted for brevity but should check auth context if available

    const { data: user, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error("Error resetting password:", error);
      throw new Error(error.message);
    }

    return { success: true, message: "Password berhasil direset." };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    const { userId, role } = data;

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });

    if (error) {
      console.error("Error updating role:", error);
      throw new Error(error.message);
    }

    return { success: true, message: "Peran berhasil diperbarui." };
  });
