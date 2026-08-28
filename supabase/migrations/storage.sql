-- Create buckets if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('asset-photos', 'asset-photos', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "storage read staff" ON storage.objects;
DROP POLICY IF EXISTS "storage upload staff" ON storage.objects;
DROP POLICY IF EXISTS "storage update staff" ON storage.objects;
DROP POLICY IF EXISTS "storage delete manage" ON storage.objects;

CREATE POLICY "storage read staff" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('asset-photos','documents') AND public.is_staff());

CREATE POLICY "storage upload staff" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('asset-photos','documents') AND (public.can_manage_assets() OR public.has_role(auth.uid(),'auditor')));

CREATE POLICY "storage update staff" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('asset-photos','documents') AND (public.can_manage_assets() OR public.has_role(auth.uid(),'auditor')));

CREATE POLICY "storage delete manage" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('asset-photos','documents') AND public.can_manage_assets());