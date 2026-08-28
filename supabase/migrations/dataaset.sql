-- ENUM peran
CREATE TYPE public.app_role AS ENUM ('admin_utama','operator_aset','auditor','pimpinan');

-- ROLES (master)
CREATE TABLE public.roles (
  id bigserial PRIMARY KEY,
  name public.app_role UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- USERS (profil, terhubung ke auth.users)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username varchar(50) UNIQUE NOT NULL,
  full_name varchar(150) NOT NULL,
  email varchar(150) UNIQUE,
  phone varchar(30),
  photo varchar(255),
  status varchar(20) NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- can manage master/asset data
CREATE OR REPLACE FUNCTION public.can_manage_assets()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
                 AND role IN ('admin_utama','operator_aset'));
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_utama');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

CREATE POLICY "roles readable" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users read all staff" ON public.users FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "users update self" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users admin manage" ON public.users FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "user_roles read" ON public.user_roles FOR SELECT TO authenticated USING (public.is_staff());

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new auth user -> profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'operator_aset'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id bigserial PRIMARY KEY,
  code varchar(30) UNIQUE NOT NULL,
  name varchar(100) UNIQUE NOT NULL,
  description text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.categories FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "cat manage" ON public.categories FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_cat_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LOCATIONS
CREATE TABLE public.locations (
  id bigserial PRIMARY KEY,
  code varchar(30) UNIQUE NOT NULL,
  name varchar(150) NOT NULL,
  building varchar(100),
  floor varchar(50),
  room varchar(100),
  description text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc read" ON public.locations FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "loc manage" ON public.locations FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_loc_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ASSETS
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id bigint NOT NULL REFERENCES public.categories(id),
  location_id bigint NOT NULL REFERENCES public.locations(id),
  created_by uuid REFERENCES public.users(id),
  asset_code varchar(50) UNIQUE NOT NULL,
  asset_name varchar(150) NOT NULL,
  serial_number varchar(100),
  brand varchar(100),
  model varchar(100),
  specification text,
  acquisition_date date NOT NULL,
  acquisition_price numeric(18,2) NOT NULL DEFAULT 0,
  useful_life_years int,
  residual_value numeric(18,2) NOT NULL DEFAULT 0,
  condition_status varchar(30) NOT NULL DEFAULT 'baik',
  asset_status varchar(30) NOT NULL DEFAULT 'tersedia',
  ownership_status varchar(30) NOT NULL DEFAULT 'milik_daerah',
  description text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_category ON public.assets(category_id);
CREATE INDEX idx_assets_location ON public.assets(location_id);
CREATE INDEX idx_assets_condition ON public.assets(condition_status);
CREATE INDEX idx_assets_status ON public.assets(asset_status);
CREATE INDEX idx_assets_date ON public.assets(acquisition_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset read" ON public.assets FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "asset manage" ON public.assets FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_asset_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ASSET PHOTOS
CREATE TABLE public.asset_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  file_path varchar(255) NOT NULL,
  file_name varchar(150),
  is_primary boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_photos_asset ON public.asset_photos(asset_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_photos TO authenticated;
GRANT ALL ON public.asset_photos TO service_role;
ALTER TABLE public.asset_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photo read" ON public.asset_photos FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "photo manage" ON public.asset_photos FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());

-- QR CODES
CREATE TABLE public.asset_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid UNIQUE NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  qr_token varchar(100) UNIQUE NOT NULL,
  qr_image_path varchar(255),
  generated_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz,
  print_count int NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_qr_codes TO authenticated;
GRANT ALL ON public.asset_qr_codes TO service_role;
ALTER TABLE public.asset_qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr read" ON public.asset_qr_codes FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "qr manage" ON public.asset_qr_codes FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());

-- MUTATIONS
CREATE TABLE public.asset_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_location_id bigint REFERENCES public.locations(id),
  to_location_id bigint NOT NULL REFERENCES public.locations(id),
  mutation_date timestamptz NOT NULL DEFAULT now(),
  reason text,
  document_number varchar(100),
  attachment varchar(255),
  approved_by uuid REFERENCES public.users(id),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mutation_asset ON public.asset_mutations(asset_id);
GRANT SELECT, INSERT, UPDATE ON public.asset_mutations TO authenticated;
GRANT ALL ON public.asset_mutations TO service_role;
ALTER TABLE public.asset_mutations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mut read" ON public.asset_mutations FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "mut insert" ON public.asset_mutations FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets());
CREATE POLICY "mut update" ON public.asset_mutations FOR UPDATE TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());

-- LOANS
CREATE TABLE public.asset_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  borrower_name varchar(150) NOT NULL,
  borrower_unit varchar(150),
  borrower_contact varchar(50),
  loan_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz,
  return_date timestamptz,
  loan_condition varchar(30),
  return_condition varchar(30),
  purpose text,
  status varchar(30) NOT NULL DEFAULT 'borrowed',
  approved_by uuid REFERENCES public.users(id),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loans_asset ON public.asset_loans(asset_id);
CREATE INDEX idx_loans_status ON public.asset_loans(status);
GRANT SELECT, INSERT, UPDATE ON public.asset_loans TO authenticated;
GRANT ALL ON public.asset_loans TO service_role;
ALTER TABLE public.asset_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan read" ON public.asset_loans FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "loan insert" ON public.asset_loans FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets());
CREATE POLICY "loan update" ON public.asset_loans FOR UPDATE TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_loan_updated BEFORE UPDATE ON public.asset_loans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MAINTENANCE
CREATE TABLE public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_date date NOT NULL,
  maintenance_type varchar(50) NOT NULL,
  vendor_name varchar(150),
  description text,
  cost numeric(18,2) NOT NULL DEFAULT 0,
  condition_before varchar(30),
  condition_after varchar(30),
  start_date date,
  finish_date date,
  attachment varchar(255),
  status varchar(30) NOT NULL DEFAULT 'completed',
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_maintenance_asset ON public.maintenance_records(asset_id);
GRANT SELECT, INSERT, UPDATE ON public.maintenance_records TO authenticated;
GRANT ALL ON public.maintenance_records TO service_role;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mnt read" ON public.maintenance_records FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "mnt insert" ON public.maintenance_records FOR INSERT TO authenticated WITH CHECK (public.can_manage_assets());
CREATE POLICY "mnt update" ON public.maintenance_records FOR UPDATE TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_mnt_updated BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT SCHEDULES
CREATE TABLE public.audit_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(150) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location_id bigint REFERENCES public.locations(id),
  category_id bigint REFERENCES public.categories(id),
  assigned_to uuid REFERENCES public.users(id),
  status varchar(30) NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.audit_schedules TO authenticated;
GRANT ALL ON public.audit_schedules TO service_role;
ALTER TABLE public.audit_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched read" ON public.audit_schedules FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "sched insert" ON public.audit_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "sched update" ON public.audit_schedules FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_role(auth.uid(),'auditor')) WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER trg_sched_updated BEFORE UPDATE ON public.audit_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT RESULTS
CREATE TABLE public.audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_schedule_id uuid NOT NULL REFERENCES public.audit_schedules(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  auditor_id uuid REFERENCES public.users(id),
  scan_time timestamptz,
  physical_found boolean NOT NULL DEFAULT false,
  code_match boolean NOT NULL DEFAULT false,
  location_match boolean NOT NULL DEFAULT false,
  condition_match boolean NOT NULL DEFAULT false,
  audit_status varchar(30) NOT NULL,
  notes text,
  recommendation text,
  evidence_photo varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_result_schedule ON public.audit_results(audit_schedule_id);
CREATE INDEX idx_audit_result_asset ON public.audit_results(asset_id);
GRANT SELECT, INSERT, UPDATE ON public.audit_results TO authenticated;
GRANT ALL ON public.audit_results TO service_role;
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "res read" ON public.audit_results FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "res insert" ON public.audit_results FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "res update" ON public.audit_results FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_role(auth.uid(),'auditor')) WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));

-- AUDIT FINDINGS
CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id uuid NOT NULL REFERENCES public.audit_results(id) ON DELETE CASCADE,
  finding_type varchar(50) NOT NULL,
  description text NOT NULL,
  recommendation text,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  status varchar(30) NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_status ON public.audit_findings(status);
GRANT SELECT, INSERT, UPDATE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "find read" ON public.audit_findings FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "find insert" ON public.audit_findings FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "find update" ON public.audit_findings FOR UPDATE TO authenticated USING (public.is_admin() OR public.has_role(auth.uid(),'auditor')) WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'auditor'));

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  action varchar(50) NOT NULL,
  module varchar(50) NOT NULL,
  table_name varchar(100),
  record_id text,
  description text,
  old_data jsonb,
  new_data jsonb,
  ip_address varchar(45),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_logs_created ON public.activity_logs(created_at DESC);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log read" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "log insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- SYSTEM SETTINGS
CREATE TABLE public.system_settings (
  id bigserial PRIMARY KEY,
  setting_key varchar(100) UNIQUE NOT NULL,
  setting_value text,
  description text,
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "set read" ON public.system_settings FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "set manage" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PUBLIC QR LOOKUP (tanpa data sensitif)
CREATE OR REPLACE FUNCTION public.get_asset_by_qr(_token text)
RETURNS TABLE (
  asset_code varchar, asset_name varchar, category_name varchar, brand varchar,
  model varchar, serial_number varchar, location_name varchar, room varchar,
  building varchar, condition_status varchar, asset_status varchar, photo_path varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.asset_code, a.asset_name, c.name, a.brand, a.model, a.serial_number,
         l.name, l.room, l.building, a.condition_status, a.asset_status,
         (SELECT p.file_path FROM public.asset_photos p WHERE p.asset_id = a.id ORDER BY p.is_primary DESC, p.created_at LIMIT 1)
  FROM public.asset_qr_codes q
  JOIN public.assets a ON a.id = q.asset_id
  JOIN public.categories c ON c.id = a.category_id
  JOIN public.locations l ON l.id = a.location_id
  WHERE q.qr_token = _token AND q.status = 'active' AND a.deleted_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_asset_by_qr(text) TO anon, authenticated;

-- SEED
INSERT INTO public.roles (name, label, description) VALUES
 ('admin_utama','Admin Utama','Akses penuh seluruh modul'),
 ('operator_aset','Operator Aset','Mengelola data aset dan transaksi'),
 ('auditor','Auditor','Melaksanakan audit aset'),
 ('pimpinan','Pimpinan','Monitoring dan laporan (read-only)');

INSERT INTO public.categories (code, name, description) VALUES
 ('KAT-ELK','Elektronik','Peralatan elektronik kantor'),
 ('KAT-KOM','Komputer','Perangkat komputer dan jaringan'),
 ('KAT-KEN','Kendaraan','Kendaraan dinas'),
 ('KAT-FUR','Furnitur','Meubelair kantor'),
 ('KAT-MSN','Mesin','Mesin dan peralatan teknis'),
 ('KAT-INV','Inventaris Kantor','Inventaris umum kantor');

INSERT INTO public.locations (code, name, building, floor, room) VALUES
 ('LOK-SRV','Ruang Server','Gedung Diskominfo','Lantai 2','Server Room'),
 ('LOK-KDN','Ruang Kepala Dinas','Gedung Diskominfo','Lantai 2','Kadis'),
 ('LOK-SEK','Ruang Sekretariat','Gedung Diskominfo','Lantai 1','Sekretariat'),
 ('LOK-INF','Ruang Bidang Informatika','Gedung Diskominfo','Lantai 2','Informatika'),
 ('LOK-SAN','Ruang Persandian','Gedung Diskominfo','Lantai 1','Persandian'),
 ('LOK-GDG','Gudang','Gedung Diskominfo','Lantai 1','Gudang');

INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
 ('app_name','SIMAKO','Nama aplikasi'),
 ('institution_name','Dinas Komunikasi dan Informatika','Nama instansi'),
 ('institution_address','Kabupaten Bondowoso','Alamat instansi'),
 ('qr_base_url','/asset/qr','Base URL QR Code');