# Mindset 🚀

Mindset adalah aplikasi Manajemen Informasi Data Aset yang dilengkapi dengan fitur transaksi peminjaman, pelacakan lokasi, dan pemindaian QR Code. Proyek ini dibangun dengan antarmuka modern berbasis TypeScript, Vite, dan Supabase.

## 🌟 Fitur Utama

*   **Manajemen Aset & Kategori:** Mengelola daftar aset, kategori barang, dan lokasi penyimpanan (`assets`, `categories`, `locations`).
*   **Transaksi & Peminjaman:** Sistem untuk mencatat barang masuk dan keluar (`transactions/in`, `transactions/out`), serta modul peminjaman aset (`loans`).
*   **Integrasi QR Code:** Fitur pembuatan dan pemindaian QR Code untuk pelacakan aset secara cepat (`qr`, `scan`).
*   **Audit & Laporan:** Pencatatan log aktivitas, riwayat mutasi, dan laporan sistem (`audit`, `activity-logs`, `mutations`, `reports`).
*   **Manajemen Pengguna & Vendor:** Pengelolaan hak akses pengguna, profil, dan data vendor (`users`, `profile`, `vendors`).
*   **Autentikasi Aman:** Sistem otentikasi terintegrasi dengan proteksi rute (*middleware*) untuk halaman dasbor (`login.tsx`, `_authenticated/`).

## 💻 Teknologi yang Digunakan

*   **Frontend:** TypeScript, Vite (`vite.config.ts`, `tsconfig.json`).
*   **Routing:** File-based routing system (`src/routeTree.gen.ts`, `src/router.tsx`).
*   **Komponen UI:** Pustaka komponen UI modular (`src/components/ui/` seperti *table, dialog, card, dll*).
*   **Backend (BaaS):** Supabase untuk database, autentikasi, dan penyimpanan (`src/integrations/supabase/`, `supabase/config.toml`).
*   **Package Manager:** Bun (`bun.lock`) atau NPM (`package-lock.json`).

## ⚙️ Prasyarat Instalasi

*   [Bun](https://bun.sh/) (direkomendasikan) atau Node.js beserta NPM.
*   Akun dan proyek [Supabase](https://supabase.com/) atau Supabase CLI untuk *local development*.
*   Git.

## 🚀 Langkah-langkah Menginstall Project

1.  **Kloning Repositori**
    ```bash
    git clone https://github.com/username/mindset.git
    cd mindset
    ```

2.  **Instalasi Dependensi**
    Gunakan Bun atau NPM untuk menginstal semua *library* yang dibutuhkan[cite: 14].
    ```bash
    bun install
    # atau
    npm install
    ```

3.  **Konfigurasi Environment**
    Salin file *environment template* dan isi dengan kredensial Supabase Anda[cite: 14].
    ```bash
    cp .env.example .env
    ```
    Isi nilai variabel lingkungan di dalam `.env` dengan URL dan *Anon Key* dari proyek Supabase Anda[cite: 14].

4.  **Menjalankan Migrasi Database (Opsional)**
    Jika Anda menggunakan Supabase lokal, jalankan migrasi yang tersedia di folder `supabase/migrations/`[cite: 14].
    ```bash
    supabase start
    supabase db push
    ```

5.  **Menjalankan Server Pengembangan**
    ```bash
    bun run dev
    # atau
    npm run dev
    ```
    Aplikasi dapat diakses melalui browser pada port lokal yang disediakan oleh Vite[cite: 14].

## 📁 Susunan Project

```text
mindset/
├── public/                 # Aset statis (favicon, logo, robots.txt)[cite: 14]
├── src/                    # Kode sumber utama aplikasi[cite: 14]
│   ├── actions/            # Fungsi aksi backend/API (users.ts)[cite: 14]
│   ├── assets/             # Aset gambar aplikasi[cite: 14]
│   ├── components/         # Komponen antarmuka (ui, layout, assets, transactions)[cite: 14]
│   ├── hooks/              # Custom React hooks (useAssets, useCurrentUser)[cite: 14]
│   ├── integrations/       # Integrasi pihak ketiga (Konfigurasi dan Client Supabase)[cite: 14]
│   ├── lib/                # Fungsi utilitas, format, dan konfigurasi error[cite: 14]
│   └── routes/             # Halaman aplikasi berbasis rute (dashboard, login, aset, dll)[cite: 14]
├── supabase/               # Konfigurasi Supabase dan file migrasi SQL[cite: 14]
├── .env.example            # Template environment variables[cite: 14]
├── bun.lock & package.json # Pengelolaan dependensi proyek[cite: 14]
└── vite.config.ts          # Konfigurasi bundler Vite[cite: 14]
