-- ============================================================================
-- DIRIDESMOB - PATCH FINAL EXCLUSIVAMENTE DE SEGURANÇA RLS
-- ============================================================================

-- 1. AJUSTES DE ENUM DE SUCATA (Status coerente para classificação física descentralizada)
ALTER TYPE scrap_status ADD VALUE IF NOT EXISTS 'CLASSIFICADA';
ALTER TYPE scrap_status ADD VALUE IF NOT EXISTS 'DISPONIVEL_PARA_DESTINACAO';

-- 2. FUNÇÕES AUXILIARES DE RLS (Search Path Seguro)
CREATE OR REPLACE FUNCTION auth_user_role() 
RETURNS user_system_role 
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp AS $$
    SELECT system_role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_has_location_access(p_loc_id UUID) 
RETURNS BOOLEAN 
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_location_access 
        WHERE user_id = auth.uid() AND location_id = p_loc_id
    );
$$;

-- 3. DROP DAS POLICIES INSEGURAS QUE CONTINHAM USING (TRUE) EM DADOS PRIVADOS
DROP POLICY IF EXISTS "p_mob_plt_sel" ON mobilization_pallets;
DROP POLICY IF EXISTS "p_mob_itm_sel" ON mobilization_items;
DROP POLICY IF EXISTS "p_plt_items_sel" ON pallet_items;
DROP POLICY IF EXISTS "p_plt_items_write" ON pallet_items;
DROP POLICY IF EXISTS "p_load_pallets_sel" ON load_pallets;
DROP POLICY IF EXISTS "p_load_pallets_write" ON load_pallets;
DROP POLICY IF EXISTS "p_conf_pallets_all" ON conference_pallets;
DROP POLICY IF EXISTS "p_conf_pallets_sel" ON conference_pallets;
DROP POLICY IF EXISTS "p_conf_pallets_write" ON conference_pallets;
DROP POLICY IF EXISTS "p_conf_items_all" ON conference_items;
DROP POLICY IF EXISTS "p_conf_items_sel" ON conference_items;
DROP POLICY IF EXISTS "p_conf_items_write" ON conference_items;
DROP POLICY IF EXISTS "p_div_sel" ON divergences;
DROP POLICY IF EXISTS "p_div_write" ON divergences;
DROP POLICY IF EXISTS "p_div_photos_all" ON divergence_photos;
DROP POLICY IF EXISTS "p_div_photos_sel" ON divergence_photos;
DROP POLICY IF EXISTS "p_div_photos_ins" ON divergence_photos;
DROP POLICY IF EXISTS "p_loss_meetings_sel" ON loss_meetings;
DROP POLICY IF EXISTS "p_loss_meetings_adm" ON loss_meetings;
DROP POLICY IF EXISTS "p_loss_m_losses_all" ON loss_meeting_losses;
DROP POLICY IF EXISTS "p_loss_m_div_all" ON loss_meeting_divergences;
DROP POLICY IF EXISTS "p_scrap_sel" ON scrap_items;
DROP POLICY IF EXISTS "p_scrap_adm" ON scrap_items;
DROP POLICY IF EXISTS "p_inv_res_sel" ON inventory_reservations;
DROP POLICY IF EXISTS "p_idem_sel" ON operation_idempotency;
DROP POLICY IF EXISTS "p_notif_sel" ON notifications;
DROP POLICY IF EXISTS "p_notif_upd" ON notifications;

-- 4. POLICIES HERDADAS E SEGREGADAS POR LOCALIZAÇÃO (ZERO USING TRUE EM DADOS PRIVADOS)

-- 4.1. Mobilizações (Filhos navegam até destination_work_id)
CREATE POLICY "p_mob_pallets_sel" ON mobilization_pallets FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM mobilizations m 
        WHERE m.id = mobilization_pallets.mobilization_id 
          AND auth_user_has_location_access(m.destination_work_id)
    )
);

CREATE POLICY "p_mob_items_sel" ON mobilization_items FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM mobilization_pallets mp
        JOIN mobilizations m ON m.id = mp.mobilization_id
        WHERE mp.id = mobilization_items.mobilization_pallet_id 
          AND auth_user_has_location_access(m.destination_work_id)
    )
);

-- 4.2. Pallets de Desmobilização e Itens (Herdam origin_location_id)
CREATE POLICY "p_pallet_items_sel" ON pallet_items FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM demobilization_pallets dp
        WHERE dp.id = pallet_items.pallet_id 
          AND auth_user_has_location_access(dp.origin_location_id)
    )
);

CREATE POLICY "p_pallet_items_write" ON pallet_items FOR ALL TO authenticated
USING (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM demobilization_pallets dp
        WHERE dp.id = pallet_items.pallet_id 
          AND auth_user_has_location_access(dp.origin_location_id) 
          AND dp.status = 'EM_MONTAGEM'
    )
)
WITH CHECK (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM demobilization_pallets dp
        WHERE dp.id = pallet_items.pallet_id 
          AND auth_user_has_location_access(dp.origin_location_id) 
          AND dp.status = 'EM_MONTAGEM'
    )
);

-- 4.3. Cargas e Pallets da Carga (Herdam origin_location_id e destination_location_id)
CREATE POLICY "p_load_pallets_sel" ON load_pallets FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM loads l
        WHERE l.id = load_pallets.load_id 
          AND (auth_user_has_location_access(l.origin_location_id) OR auth_user_has_location_access(l.destination_location_id))
    )
);

CREATE POLICY "p_load_pallets_write" ON load_pallets FOR ALL TO authenticated
USING (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM loads l
        WHERE l.id = load_pallets.load_id 
          AND auth_user_has_location_access(l.origin_location_id) 
          AND l.status IN ('RASCUNHO', 'PRONTA_PARA_ENVIO')
    )
)
WITH CHECK (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM loads l
        WHERE l.id = load_pallets.load_id 
          AND auth_user_has_location_access(l.origin_location_id) 
          AND l.status IN ('RASCUNHO', 'PRONTA_PARA_ENVIO')
    )
);

-- 4.4. Conferências e Itens de Conferência
CREATE POLICY "p_conf_pallets_sel" ON conference_pallets FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM conferences c
        WHERE c.id = conference_pallets.conference_id 
          AND (auth_user_has_location_access(c.destination_location_id) OR EXISTS (
              SELECT 1 FROM loads l WHERE l.id = c.load_id AND auth_user_has_location_access(l.origin_location_id)
          ))
    )
);

CREATE POLICY "p_conf_pallets_write" ON conference_pallets FOR ALL TO authenticated
USING (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM conferences c
        WHERE c.id = conference_pallets.conference_id 
          AND auth_user_has_location_access(c.destination_location_id) 
          AND c.status = 'EM_ANDAMENTO'
    )
)
WITH CHECK (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM conferences c
        WHERE c.id = conference_pallets.conference_id 
          AND auth_user_has_location_access(c.destination_location_id) 
          AND c.status = 'EM_ANDAMENTO'
    )
);

CREATE POLICY "p_conf_items_sel" ON conference_items FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM conference_pallets cp
        JOIN conferences c ON c.id = cp.conference_id
        WHERE cp.id = conference_items.conference_pallet_id 
          AND (auth_user_has_location_access(c.destination_location_id) OR EXISTS (
              SELECT 1 FROM loads l WHERE l.id = c.load_id AND auth_user_has_location_access(l.origin_location_id)
          ))
    )
);

CREATE POLICY "p_conf_items_write" ON conference_items FOR ALL TO authenticated
USING (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM conference_pallets cp
        JOIN conferences c ON c.id = cp.conference_id
        WHERE cp.id = conference_items.conference_pallet_id 
          AND auth_user_has_location_access(c.destination_location_id) 
          AND c.status = 'EM_ANDAMENTO'
    )
)
WITH CHECK (
    auth_user_role() = 'ADMINISTRADOR' OR 
    EXISTS (
        SELECT 1 FROM conference_pallets cp
        JOIN conferences c ON c.id = cp.conference_id
        WHERE cp.id = conference_items.conference_pallet_id 
          AND auth_user_has_location_access(c.destination_location_id) 
          AND c.status = 'EM_ANDAMENTO'
    )
);

-- 4.5. Divergências e Evidências Fotográficas
CREATE POLICY "p_divergences_sel" ON divergences FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM loads l 
        WHERE l.id = divergences.load_id 
          AND (auth_user_has_location_access(l.origin_location_id) OR auth_user_has_location_access(l.destination_location_id))
    )
);

CREATE POLICY "p_divergences_adm" ON divergences FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

CREATE POLICY "p_div_photos_sel" ON divergence_photos FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM divergences d
        JOIN loads l ON l.id = d.load_id
        WHERE d.id = divergence_photos.divergence_id 
          AND (auth_user_has_location_access(l.origin_location_id) OR auth_user_has_location_access(l.destination_location_id))
    )
);

CREATE POLICY "p_div_photos_ins" ON divergence_photos FOR INSERT TO authenticated
WITH CHECK (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM divergences d
        JOIN loads l ON l.id = d.load_id
        WHERE d.id = divergence_photos.divergence_id 
          AND auth_user_has_location_access(l.destination_location_id)
    )
);

-- 4.6. Reuniões de Perdas e Relacionamentos
CREATE POLICY "p_loss_meetings_sel" ON loss_meetings FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    auth_user_has_location_access(work_id)
);

CREATE POLICY "p_loss_meetings_adm" ON loss_meetings FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

CREATE POLICY "p_loss_m_losses_sel" ON loss_meeting_losses FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM loss_meetings lm 
        WHERE lm.id = loss_meeting_losses.loss_meeting_id 
          AND auth_user_has_location_access(lm.work_id)
    )
);

CREATE POLICY "p_loss_m_div_sel" ON loss_meeting_divergences FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    EXISTS (
        SELECT 1 FROM loss_meetings lm 
        WHERE lm.id = loss_meeting_divergences.loss_meeting_id 
          AND auth_user_has_location_access(lm.work_id)
    )
);

-- 4.7. Sucatas e Reservas de Inventário
CREATE POLICY "p_scrap_items_sel" ON scrap_items FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    auth_user_has_location_access(current_location_id)
);

CREATE POLICY "p_scrap_items_block_write" ON scrap_items FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY "p_inv_res_sel" ON inventory_reservations FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
    auth_user_has_location_access(location_id)
);

CREATE POLICY "p_inv_res_block_write" ON inventory_reservations FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- 4.8. Tabela Interna de Idempotência (Apenas Diagnóstico Admin - Sem Acesso a Usuários Comuns)
CREATE POLICY "p_idem_admin_sel" ON operation_idempotency FOR SELECT TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR');

CREATE POLICY "p_idem_block_write" ON operation_idempotency FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- 4.9. Notificações Segregadas e RPC Segura de Leitura
CREATE POLICY "p_notif_sel" ON notifications FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR 
    (target_location_id IS NOT NULL AND auth_user_has_location_access(target_location_id)) OR
    (target_role IS NOT NULL AND target_role = auth_user_role() AND target_location_id IS NULL)
);

CREATE POLICY "p_notif_block_write" ON notifications FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

CREATE OR REPLACE FUNCTION fn_mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_notif RECORD;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;

    SELECT * INTO v_notif FROM notifications WHERE id = p_notification_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;

    IF v_notif.user_id = v_user_id OR 
       (v_notif.target_location_id IS NOT NULL AND auth_user_has_location_access(v_notif.target_location_id)) OR
       (v_notif.target_role IS NOT NULL AND v_notif.target_role = auth_user_role()) THEN
        UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = p_notification_id;
    ELSE
        RAISE EXCEPTION 'Não autorizado a marcar esta notificação como lida.';
    END IF;
END;
$$;

-- 5. POLICIES DE STORAGE SUPABASE (Bucket Privado: divergence-photos)
-- INSERT: Usuário com acesso ao destino da carga da divergência
CREATE POLICY "storage_divergence_photos_insert" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
    bucket_id = 'divergence-photos' AND 
    (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
     auth_user_has_location_access((SPLIT_PART(name, '/', 2))::UUID))
);

-- SELECT: Administrador, Analista ou usuário da Origem/Destino
CREATE POLICY "storage_divergence_photos_select" 
ON storage.objects FOR SELECT TO authenticated 
USING (
    bucket_id = 'divergence-photos' AND 
    (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
     auth_user_has_location_access((SPLIT_PART(name, '/', 2))::UUID))
);

-- UPDATE e DELETE bloqueados no bucket de evidências
CREATE POLICY "storage_divergence_photos_block_del" 
ON storage.objects FOR DELETE TO authenticated 
USING (FALSE);

CREATE POLICY "storage_divergence_photos_block_upd" 
ON storage.objects FOR UPDATE TO authenticated 
USING (FALSE);
