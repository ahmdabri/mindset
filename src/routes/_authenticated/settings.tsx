import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan - MINDSET Diskominfo" },
      { name: "description", content: "Konfigurasi aplikasi dan instansi." },
    ],
  }),
  component: Page,
});

type SystemSetting = {
  setting_key: string;
  setting_value: string;
  description: string;
};

function Page() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SystemSetting[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["system_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*");
      if (error) throw error;
      return data as SystemSetting[];
    },
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: SystemSetting[]) => {
      // Update each setting
      for (const setting of updatedSettings) {
        const { error } = await supabase
          .from("system_settings")
          .update({ setting_value: setting.setting_value })
          .eq("setting_key", setting.setting_key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Pengaturan berhasil disimpan.");
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
    },
    onError: (error) => {
      toast.error(`Gagal menyimpan pengaturan: ${error.message}`);
    },
  });

  const handleValueChange = (key: string, newValue: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.setting_key === key ? { ...s, setting_value: newValue } : s)),
    );
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  return (
    <ModuleGuard module="settings">
      <div className="space-y-6">
        <PageHeader
          title="Pengaturan Sistem"
          description="Konfigurasi variabel dan parameter aplikasi"
        />

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Parameter Umum</CardTitle>
            <CardDescription>
              Sesuaikan nilai pengaturan di bawah ini sesuai kebutuhan instansi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div>Memuat pengaturan...</div>
            ) : settings.length === 0 ? (
              <div>Tidak ada pengaturan sistem yang tersedia.</div>
            ) : (
              settings.map((setting) => (
                <div key={setting.setting_key} className="space-y-2">
                  <Label htmlFor={setting.setting_key} className="font-semibold text-base">
                    {setting.description || setting.setting_key}
                  </Label>
                  <Input
                    id={setting.setting_key}
                    value={setting.setting_value}
                    onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                  />
                </div>
              ))
            )}

            <Button
              className="w-full sm:w-auto mt-4"
              onClick={handleSave}
              disabled={isLoading || updateSettingsMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateSettingsMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModuleGuard>
  );
}
