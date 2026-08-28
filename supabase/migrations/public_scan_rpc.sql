CREATE OR REPLACE FUNCTION public.get_public_asset_by_token(token_val TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    res json;
    target_id UUID := NULL;
BEGIN
    -- Cek apakah token_val adalah UUID (direct access)
    IF token_val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        target_id := token_val::UUID;
    ELSE
        -- Cari asset_id berdasarkan qr_token
        SELECT asset_id INTO target_id FROM public.asset_qr_codes WHERE qr_token = token_val LIMIT 1;
    END IF;

    IF target_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT json_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'asset_name', a.asset_name,
        'brand', a.brand,
        'model', a.model,
        'serial_number', a.serial_number,
        'condition_status', a.condition_status,
        'asset_status', a.asset_status,
        'acquisition_date', a.acquisition_date,
        'acquisition_price', a.acquisition_price,
        'categories', (SELECT json_build_object('name', name) FROM public.categories WHERE id = a.category_id),
        'locations', (SELECT json_build_object('name', name, 'building', building, 'room', room) FROM public.locations WHERE id = a.location_id)
    ) INTO res
    FROM public.assets a
    WHERE a.id = target_id AND a.deleted_at IS NULL;
    
    RETURN res;
END;
$$;
