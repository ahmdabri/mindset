-- VENDORS
CREATE TABLE public.vendors (
  id bigserial PRIMARY KEY,
  name varchar(150) NOT NULL,
  address text,
  phone varchar(50),
  email varchar(150),
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor read" ON public.vendors FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "vendor manage" ON public.vendors FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORK TYPES (Jenis Pekerjaan)
CREATE TABLE public.work_types (
  id bigserial PRIMARY KEY,
  code varchar(30) UNIQUE NOT NULL,
  name varchar(150) NOT NULL,
  description text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_types TO authenticated;
GRANT ALL ON public.work_types TO service_role;
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_type read" ON public.work_types FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "work_type manage" ON public.work_types FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_work_types_updated BEFORE UPDATE ON public.work_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVENTORY TRANSACTIONS
CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  vendor_id bigint REFERENCES public.vendors(id),
  work_type_id bigint REFERENCES public.work_types(id),
  transaction_no varchar(50) UNIQUE NOT NULL,
  type varchar(20) NOT NULL, -- 'IN', 'OUT'
  transaction_date date NOT NULL,
  reference_no varchar(100),
  destination text,
  status varchar(30) NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_trx_date ON public.inventory_transactions(transaction_date);
CREATE INDEX idx_inv_trx_type ON public.inventory_transactions(type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_trx read" ON public.inventory_transactions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "inv_trx manage" ON public.inventory_transactions FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_inv_trx_updated BEFORE UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVENTORY TRANSACTION DETAILS
CREATE TABLE public.inventory_transaction_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(18,2) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_trx_det_trx ON public.inventory_transaction_details(transaction_id);
CREATE INDEX idx_inv_trx_det_asset ON public.inventory_transaction_details(asset_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transaction_details TO authenticated;
GRANT ALL ON public.inventory_transaction_details TO service_role;
ALTER TABLE public.inventory_transaction_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_trx_det read" ON public.inventory_transaction_details FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "inv_trx_det manage" ON public.inventory_transaction_details FOR ALL TO authenticated USING (public.can_manage_assets()) WITH CHECK (public.can_manage_assets());
CREATE TRIGGER trg_inv_trx_det_updated BEFORE UPDATE ON public.inventory_transaction_details FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
