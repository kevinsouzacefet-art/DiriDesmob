-- ============================================================================
-- 006_FUNCTIONS_AND_SECURITY.SQL
-- DiriDesmob Foundation - Helper Functions, RPCs and Row Level Security
-- ============================================================================

-- Helper functions
CREATE OR REPLACE FUNCTION auth_user_role() 
RETURNS user_system_role 
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp AS $$
    SELECT system_role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_has_location_access(p_loc_id UUID) 
RETURNS BOOLEAN 
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_location_access 
        WHERE user_id = auth.uid() AND location_id = p_loc_id
    );
$$;

-- Notification Read Safe RPC
CREATE OR REPLACE FUNCTION fn_mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_notif RECORD;
BEGIN
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Usuário não autenticado.'; 
    END IF;

    SELECT * INTO v_notif FROM public.notifications WHERE id = p_notification_id;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Notificação não encontrada.'; 
    END IF;

    IF v_notif.user_id = v_user_id OR 
       (v_notif.target_location_id IS NOT NULL AND auth_user_has_location_access(v_notif.target_location_id)) OR
       (v_notif.target_role IS NOT NULL AND v_notif.target_role = auth_user_role()) THEN
        UPDATE public.notifications SET is_read = TRUE, read_at = NOW() WHERE id = p_notification_id;
    ELSE
        RAISE EXCEPTION 'Não autorizado a marcar esta notificação como lida.';
    END IF;
END;
$$;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilization_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilization_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demobilization_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergence_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meeting_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meeting_divergences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "p_profiles_sel" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

CREATE POLICY "p_profiles_adm" ON public.profiles FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 2. Locations Policies
CREATE POLICY "p_locations_sel" ON public.locations FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "p_locations_adm" ON public.locations FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 3. Works Policies
CREATE POLICY "p_works_sel" ON public.works FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "p_works_adm" ON public.works FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 4. Suppliers Policies
CREATE POLICY "p_suppliers_sel" ON public.suppliers FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "p_suppliers_adm" ON public.suppliers FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 5. User Location Access Policies
CREATE POLICY "p_user_loc_sel" ON public.user_location_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

CREATE POLICY "p_user_loc_adm" ON public.user_location_access FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 6. Materials Policies
CREATE POLICY "p_materials_sel" ON public.materials FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "p_materials_adm" ON public.materials FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 7. Notifications Policies
CREATE POLICY "p_notif_sel" ON public.notifications FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR 
    (target_location_id IS NOT NULL AND auth_user_has_location_access(target_location_id)) OR
    (target_role IS NOT NULL AND target_role = auth_user_role() AND target_location_id IS NULL)
);

CREATE POLICY "p_notif_block_write" ON public.notifications FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- 8. Idempotency Policies
CREATE POLICY "p_idem_sel" ON public.operation_idempotency FOR SELECT TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR');

CREATE POLICY "p_idem_block_write" ON public.operation_idempotency FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);
