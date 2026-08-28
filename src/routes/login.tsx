import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import kominfoBg from "@/assets/kominfo.png";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login - MINDSET Diskominfo" },
      {
        name: "description",
        content:
          "Masuk ke MINDSET, Sistem Informasi Manajemen Aset Dinas Komunikasi dan Informatika.",
      },
      { property: "og:title", content: "Login - MINDSET Diskominfo" },
      {
        property: "og:description",
        content: "Portal internal pengelolaan aset Diskominfo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  identifier: z.string().trim().min(1, "Username atau Email wajib diisi").max(255),
  password: z.string().min(1, "Password wajib diisi").max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }

    setLoading(true);

    let emailToUse = parsed.data.identifier;
    if (!emailToUse.includes("@")) {
      emailToUse = `${parsed.data.identifier.trim()}@bondowosokab.go.id`;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: parsed.data.password,
    });

    if (signInError || !data.user) {
      if (emailToUse !== parsed.data.identifier) {
        const { data: secondAttempt, error: secondError } = await supabase.auth.signInWithPassword({
          email: parsed.data.identifier,
          password: parsed.data.password,
        });

        if (secondError || !secondAttempt.user) {
          setLoading(false);
          setError("Username atau password salah. Silakan coba lagi.");
          return;
        }
      } else {
        setLoading(false);
        setError("Username atau password salah. Silakan coba lagi.");
        return;
      }
    }

    const authUser = (await supabase.auth.getUser()).data.user;
    if (authUser) {
      await supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", authUser.id);

      await supabase.from("activity_logs").insert({
        user_id: authUser.id,
        action: "LOGIN",
        module: "auth",
        description: "Pengguna berhasil masuk ke MINDSET",
        user_agent: navigator.userAgent,
      });
    }

    setLoading(false);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="bg-[#f6faff] text-[#141d23] min-h-screen md:h-screen w-full flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden select-none font-sans">
      {/* Left Branding Area */}
      <div className="relative w-full md:w-[45%] h-[240px] sm:h-[280px] md:h-full bg-[#dbe4ed] shrink-0 overflow-hidden">
        <img
          src={kominfoBg}
          alt="Dinas Komunikasi dan Informatika Bondowoso Building"
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent"></div>
        <div className="relative z-10 p-5 sm:p-7 md:p-10 lg:p-14 flex items-start gap-3 sm:gap-4">
          <img
            src="/logo minset.png"
            alt="SIMAKO Logo"
            className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-md"
          />
          <div>
            <h1 className="text-white font-bold text-2xl md:text-3xl lg:text-4xl m-0 leading-tight">
              MINDSET
            </h1>
            <p className="text-white font-medium text-xs md:text-sm m-0 opacity-90 leading-tight mt-1">
              Management Informasi
              <br />
              Data Aset
            </p>
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="w-full md:w-[55%] flex-1 bg-white flex flex-col justify-between items-center rounded-t-[32px] md:rounded-t-none md:rounded-l-[60px] lg:rounded-l-[80px] -mt-6 md:mt-0 relative z-20 px-6 py-8 sm:px-10 sm:py-10 md:px-12 md:py-12 lg:px-16 shadow-[-10px_0_30px_rgba(0,0,0,0.06)] md:shadow-[-20px_0_40px_rgba(0,0,0,0.05)] overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          {/* Header */}
          <div className="mb-6 md:mb-8 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#002678] uppercase mb-2 tracking-tight">
              LOGIN
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#444652] leading-relaxed">
              Selamat datang di MINDSET, Web Informasi terkait penyimpanan data aset
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5">
              <Alert
                variant="destructive"
                className="rounded-lg border-red-200 bg-red-50 text-red-700 py-2.5 text-xs md:text-sm"
              >
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {/* Username Input */}
            <div className="flex flex-col space-y-1.5">
              <label
                className="font-semibold text-xs sm:text-sm md:text-base text-[#747683]"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative rounded-lg transition-shadow duration-200">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Masukkan username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  className="w-full h-11 sm:h-12 px-4 rounded-lg border border-[#c4c5d4] focus:border-[#1a3d99] focus:ring-2 focus:ring-[#1a3d99]/20 text-sm md:text-base text-[#141d23] bg-white outline-none transition-all disabled:bg-slate-100"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col space-y-1.5">
              <label
                className="font-semibold text-xs sm:text-sm md:text-base text-[#747683]"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative rounded-lg transition-shadow duration-200">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full h-11 sm:h-12 px-4 pr-11 rounded-lg border border-[#c4c5d4] focus:border-[#1a3d99] focus:ring-2 focus:ring-[#1a3d99]/20 text-sm md:text-base text-[#141d23] bg-white outline-none transition-all disabled:bg-slate-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4 sm:size-5" />
                  ) : (
                    <Eye className="size-4 sm:size-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div className="pt-2 sm:pt-3 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-2/3 h-11 sm:h-12 bg-[#002678] text-white rounded-lg font-semibold text-sm sm:text-base shadow-[0px_10px_20px_rgba(26,61,153,0.2)] hover:bg-[#002678]/90 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 sm:size-5 animate-spin" /> Memproses...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Text */}
        <div className="mt-6 md:mt-8 pt-2 text-center">
          <p className="text-[11px] sm:text-xs md:text-sm font-medium text-[#444652] max-w-[280px] sm:max-w-[320px] mx-auto leading-tight">
            Akun dibuat oleh Admin Utama. Hubungi administrator bila mengalami kendala akses.
          </p>
        </div>
      </div>
    </div>
  );
}
