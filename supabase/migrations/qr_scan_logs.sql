CREATE TABLE IF NOT EXISTS public.qr_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_type TEXT,
    browser TEXT,
    platform TEXT,
    ip_address TEXT,
    latitude TEXT,
    longitude TEXT,
    scan_result TEXT DEFAULT 'SUCCESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated users to insert scan logs
CREATE POLICY "Anyone can insert scan logs" ON public.qr_scan_logs
    FOR INSERT WITH CHECK (true);

-- Only authenticated users (or staff) can view the logs
CREATE POLICY "Only staff can read scan logs" ON public.qr_scan_logs
    FOR SELECT TO authenticated USING (public.is_staff());
