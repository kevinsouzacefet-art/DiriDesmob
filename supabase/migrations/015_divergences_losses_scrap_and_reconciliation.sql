-- ============================================================================
-- 015_DIVERGENCES_LOSSES_SCRAP_AND_RECONCILIATION.SQL
-- DiriDesmob Phase 2.6 - Divergences Resolution, Physical Reconciliations,
-- Supplier Material Classification, Scrap Requests & Loss Financial Management
-- Strictly Audited, Transact Safe, Ledger Compliant & Idempotent Implementation
-- ============================================================================

-- 1. EXTEND ENUMS FOR PHASE 2.6
DO $$ BEGIN
    ALTER TYPE stock_bucket ADD VALUE IF NOT EXISTS 'REAPROVEITAVEL';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RECONCILIACAO_FALTANTE_LOCALIZADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'BAIXA_FALTANTE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RECONCILIACAO_FALTANTE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'CLASSIFICACAO_FORNECEDOR';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'MOVIMENTACAO_SUCATA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. EXTEND DIVERGENCES TABLE
ALTER TABLE public.divergences
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contest_reason TEXT,
ADD COLUMN IF NOT EXISTS contested_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS contested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolution_type TEXT,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS allocated_loss_qty NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (allocated_loss_qty >= 0);

-- 3. DIVERGENCE HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.divergence_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    divergence_id UUID NOT NULL REFERENCES public.divergences(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    notes TEXT,
    performed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_div_hist_div ON public.divergence_history(divergence_id);
CREATE INDEX IF NOT EXISTS idx_div_hist_created ON public.divergence_history(created_at DESC);

-- 4. SCRAP MOVEMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.scrap_movement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0 AND quantity = trunc(quantity)),
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA', 'EXECUTADA', 'CANCELADA')),
    load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES public.profiles(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES public.profiles(id),
    rejected_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrap_req_orig ON public.scrap_movement_requests(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_scrap_req_dest ON public.scrap_movement_requests(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_scrap_req_status ON public.scrap_movement_requests(status);
CREATE INDEX IF NOT EXISTS idx_scrap_req_mat ON public.scrap_movement_requests(material_id);
CREATE INDEX IF NOT EXISTS idx_scrap_req_load ON public.scrap_movement_requests(load_id);

DROP TRIGGER IF EXISTS trg_scrap_movement_requests_updated_at ON public.scrap_movement_requests;
CREATE TRIGGER trg_scrap_movement_requests_updated_at
BEFORE UPDATE ON public.scrap_movement_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. LOSSES TABLE (FINANCIAL DECISIONS)
CREATE TABLE IF NOT EXISTS public.losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    divergence_id UUID REFERENCES public.divergences(id) ON DELETE SET NULL,
    work_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0 AND quantity = trunc(quantity)),
    responsible_type TEXT NOT NULL CHECK (responsible_type IN ('OBRA', 'FORNECEDOR', 'TRANSPORTADORA', 'INTERNO', 'OUTRO')),
    responsible_reference_id UUID REFERENCES public.locations(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_NEGOCIACAO', 'APROVADA', 'COBRADA', 'PAGA', 'ABSORVIDA_PELA_EMPRESA')),
    applied_rate_per_m2 NUMERIC(12, 4) NOT NULL CHECK (applied_rate_per_m2 > 0),
    unit_area_m2_snapshot NUMERIC(12, 4) NOT NULL CHECK (unit_area_m2_snapshot > 0),
    calculated_value NUMERIC(14, 2) NOT NULL CHECK (calculated_value >= 0),
    charged_value NUMERIC(14, 2) CHECK (charged_value IS NULL OR charged_value >= 0),
    agreement_notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_losses_div ON public.losses(divergence_id);
CREATE INDEX IF NOT EXISTS idx_losses_work ON public.losses(work_id);
CREATE INDEX IF NOT EXISTS idx_losses_supp ON public.losses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_losses_mat ON public.losses(material_id);
CREATE INDEX IF NOT EXISTS idx_losses_status ON public.losses(status);

DROP TRIGGER IF EXISTS trg_losses_updated_at ON public.losses;
CREATE TRIGGER trg_losses_updated_at
BEFORE UPDATE ON public.losses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. LOSS MEETINGS & JUNCTION TABLES (N-N RELATIONS)
CREATE TABLE IF NOT EXISTS public.loss_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL DEFAULT 'Reunião de Alinhamento de Perdas',
    participants TEXT,
    responsible TEXT,
    decisions TEXT,
    agreement TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'REALIZADA' CHECK (status IN ('AGENDADA', 'REALIZADA', 'CANCELADA')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loss_meetings_work ON public.loss_meetings(work_id);
CREATE INDEX IF NOT EXISTS idx_loss_meetings_date ON public.loss_meetings(meeting_date DESC);

DROP TRIGGER IF EXISTS trg_loss_meetings_updated_at ON public.loss_meetings;
CREATE TRIGGER trg_loss_meetings_updated_at
BEFORE UPDATE ON public.loss_meetings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.loss_meeting_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_meeting_id UUID NOT NULL REFERENCES public.loss_meetings(id) ON DELETE CASCADE,
    loss_id UUID NOT NULL REFERENCES public.losses(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loss_meeting_loss UNIQUE (loss_meeting_id, loss_id)
);

CREATE INDEX IF NOT EXISTS idx_lml_meeting ON public.loss_meeting_losses(loss_meeting_id);
CREATE INDEX IF NOT EXISTS idx_lml_loss ON public.loss_meeting_losses(loss_id);

CREATE TABLE IF NOT EXISTS public.loss_meeting_divergences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_meeting_id UUID NOT NULL REFERENCES public.loss_meetings(id) ON DELETE CASCADE,
    divergence_id UUID NOT NULL REFERENCES public.divergences(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loss_meeting_divergence UNIQUE (loss_meeting_id, divergence_id)
);

CREATE INDEX IF NOT EXISTS idx_lmd_meeting ON public.loss_meeting_divergences(loss_meeting_id);
CREATE INDEX IF NOT EXISTS idx_lmd_divergence ON public.loss_meeting_divergences(divergence_id);

-- ============================================================================
-- 7. RLS SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.divergence_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrap_movement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meeting_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_meeting_divergences ENABLE ROW LEVEL SECURITY;

-- DIVERGENCE HISTORY POLICIES
CREATE POLICY "p_div_hist_select" ON public.divergence_history
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.divergences d
        JOIN public.loads l ON l.id = d.load_id
        JOIN public.user_location_access ula ON ula.location_id = l.destination_location_id OR ula.location_id = l.origin_location_id
        WHERE d.id = divergence_history.divergence_id AND ula.user_id = auth.uid()
    )
);

-- SCRAP MOVEMENT REQUESTS POLICIES
CREATE POLICY "p_scrap_req_select" ON public.scrap_movement_requests
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid()
          AND (ula.location_id = scrap_movement_requests.origin_location_id OR ula.location_id = scrap_movement_requests.destination_location_id)
    )
);

CREATE POLICY "p_scrap_req_insert" ON public.scrap_movement_requests
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR'
    OR EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid()
          AND ula.location_id = scrap_movement_requests.origin_location_id
    )
);

CREATE POLICY "p_scrap_req_admin" ON public.scrap_movement_requests
FOR UPDATE TO authenticated
USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR')
WITH CHECK ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR');

-- LOSSES POLICIES
CREATE POLICY "p_losses_select" ON public.losses
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid()
          AND (ula.location_id = losses.work_id OR ula.location_id = losses.supplier_id)
    )
);

CREATE POLICY "p_losses_admin" ON public.losses
FOR ALL TO authenticated
USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR')
WITH CHECK ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR');

-- LOSS MEETINGS POLICIES
CREATE POLICY "p_loss_meetings_select" ON public.loss_meetings
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR (work_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid() AND ula.location_id = loss_meetings.work_id
    ))
);

CREATE POLICY "p_loss_meetings_admin" ON public.loss_meetings
FOR ALL TO authenticated
USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR')
WITH CHECK ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR');

CREATE POLICY "p_lml_select" ON public.loss_meeting_losses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "p_lml_admin" ON public.loss_meeting_losses FOR ALL TO authenticated USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR');

CREATE POLICY "p_lmd_select" ON public.loss_meeting_divergences FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "p_lmd_admin" ON public.loss_meeting_divergences FOR ALL TO authenticated USING ((SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ADMINISTRADOR');

-- ============================================================================
-- 8. TRANSACTIONAL RPCS (SUPPLIER CLASSIFICATION, RECONCILIATIONS, LOSSES)
-- ============================================================================

-- 8.1. CLASSIFY SUPPLIER MATERIAL
CREATE OR REPLACE FUNCTION fn_classify_supplier_material(
    p_location_id UUID,
    p_material_id UUID,
    p_quantity NUMERIC,
    p_quality TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_loc public.locations%ROWTYPE;
    v_stock_rec public.stock_balances%ROWTYPE;
    v_target_bucket stock_bucket;
    v_mov_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'SUPPLIER_MATERIAL_CLASSIFY', p_location_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- 2. Validate Quality and Quantity
    IF p_quality NOT IN ('REAPROVEITAVEL', 'SUCATA') THEN
        RAISE EXCEPTION 'Qualidade inválida para classificação: %. Valores permitidos: REAPROVEITAVEL ou SUCATA.', p_quality;
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
        RAISE EXCEPTION 'Quantidade para classificação deve ser um número inteiro positivo: %', p_quantity;
    END IF;

    -- 3. Validate Location
    SELECT * INTO v_loc FROM public.locations WHERE id = p_location_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Localização não encontrada: %', p_location_id;
    END IF;

    IF v_loc.type <> 'FORNECEDOR' THEN
        RAISE EXCEPTION 'Classificação direta permitida exclusivamente em destinos do tipo FORNECEDOR.';
    END IF;

    -- 4. Authorization check
    IF v_user_role <> 'ADMINISTRADOR' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = p_location_id
        ) THEN
            RAISE EXCEPTION 'Usuário não autorizado a classificar estoque neste fornecedor.';
        END IF;
    END IF;

    -- 5. Lock AGUARDANDO_CLASSIFICACAO balance FOR UPDATE
    SELECT * INTO v_stock_rec
    FROM public.stock_balances
    WHERE location_id = p_location_id
      AND material_id = p_material_id
      AND bucket = 'AGUARDANDO_CLASSIFICACAO'
    FOR UPDATE;

    IF NOT FOUND OR v_stock_rec.quantity < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente em AGUARDANDO_CLASSIFICACAO. Disponível: %, Solicitado: %', 
            COALESCE(v_stock_rec.quantity, 0), p_quantity;
    END IF;

    -- 6. Atomic Bucket Transfer
    UPDATE public.stock_balances
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE id = v_stock_rec.id;

    IF p_quality = 'REAPROVEITAVEL' THEN
        v_target_bucket := 'REAPROVEITAVEL';
    ELSE
        v_target_bucket := 'SUCATA';
    END IF;

    INSERT INTO public.stock_balances (
        location_id,
        material_id,
        bucket,
        quantity,
        updated_at
    ) VALUES (
        p_location_id,
        p_material_id,
        v_target_bucket,
        p_quantity,
        NOW()
    )
    ON CONFLICT (location_id, material_id, bucket)
    DO UPDATE SET
        quantity = public.stock_balances.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    -- 7. Record Immutable Ledger Movement
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        destination_bucket,
        notes,
        idempotency_key,
        created_by
    ) VALUES (
        'CLASSIFICACAO_FORNECEDOR',
        p_material_id,
        p_quantity,
        p_location_id,
        p_location_id,
        v_target_bucket,
        format('Classificação de material pelo fornecedor: %s un para %s', p_quantity, p_quality),
        p_idempotency_key,
        v_user_id
    ) RETURNING id INTO v_mov_id;

    -- 8. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'SUPPLIER_MATERIAL_CLASSIFIED',
        'stock_balances',
        v_stock_rec.id,
        jsonb_build_object(
            'location_id', p_location_id,
            'material_id', p_material_id,
            'quantity', p_quantity,
            'quality', p_quality,
            'target_bucket', v_target_bucket,
            'movement_id', v_mov_id
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', format('%s unidades classificadas com sucesso como %s.', p_quantity, p_quality),
        'quantity', p_quantity,
        'quality', p_quality,
        'target_bucket', v_target_bucket
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'SUPPLIER_MATERIAL_CLASSIFY', p_location_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


-- 8.2. RECONCILE FOUND MISSING MATERIAL (FALTANTE LOCALIZADO POSTERIORMENTE)
CREATE OR REPLACE FUNCTION fn_resolve_missing_material_found(
    p_divergence_id UUID,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_div public.divergences%ROWTYPE;
    v_load public.loads%ROWTYPE;
    v_dest_loc public.locations%ROWTYPE;
    v_transit public.stock_in_transit_balances%ROWTYPE;
    v_dest_bucket stock_bucket;
    v_qty NUMERIC;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'RESOLVE_MISSING_MATERIAL', p_divergence_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Apenas Administradores podem executar reconciliação física de faltantes.';
    END IF;

    -- Lock divergence FOR UPDATE
    SELECT * INTO v_div FROM public.divergences WHERE id = p_divergence_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Divergência não encontrada: %', p_divergence_id;
    END IF;

    IF v_div.status = 'RESOLVIDA' THEN
        RAISE EXCEPTION 'Esta divergência já está resolvida.';
    END IF;

    IF v_div.type NOT IN ('FALTANTE', 'FALTA') THEN
        RAISE EXCEPTION 'Esta ação é aplicável somente a divergências do tipo FALTANTE.';
    END IF;

    v_qty := v_div.difference_qty;
    IF v_qty IS NULL OR v_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade faltante inválida na divergência: %', v_qty;
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = v_div.load_id;
    SELECT * INTO v_dest_loc FROM public.locations WHERE id = v_load.destination_location_id;

    -- Lock in-transit balance FOR UPDATE
    SELECT * INTO v_transit
    FROM public.stock_in_transit_balances
    WHERE load_id = v_load.id
      AND material_id = v_div.material_id
      AND origin_location_id = v_load.origin_location_id
      AND destination_location_id = v_load.destination_location_id
      AND (v_div.pallet_id IS NULL OR pallet_id = v_div.pallet_id)
    FOR UPDATE;

    IF NOT FOUND OR v_transit.quantity < v_qty THEN
        RAISE EXCEPTION 'Saldo em trânsito insuficiente para reconciliação. Em trânsito: %, Necessário: %',
            COALESCE(v_transit.quantity, 0), v_qty;
    END IF;

    -- Decrement in-transit balance
    IF v_transit.quantity = v_qty THEN
        DELETE FROM public.stock_in_transit_balances WHERE id = v_transit.id;
    ELSE
        UPDATE public.stock_in_transit_balances
        SET quantity = quantity - v_qty,
            updated_at = NOW()
        WHERE id = v_transit.id;
    END IF;

    -- Determine destination bucket
    IF v_dest_loc.type = 'FORNECEDOR' THEN
        v_dest_bucket := 'AGUARDANDO_CLASSIFICACAO';
    ELSE
        v_dest_bucket := 'DISPONIVEL';
    END IF;

    -- Credit physical destination stock
    INSERT INTO public.stock_balances (
        location_id,
        material_id,
        bucket,
        quantity,
        updated_at
    ) VALUES (
        v_dest_loc.id,
        v_div.material_id,
        v_dest_bucket,
        v_qty,
        NOW()
    )
    ON CONFLICT (location_id, material_id, bucket)
    DO UPDATE SET
        quantity = public.stock_balances.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    -- Record in immutable ledger
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        destination_bucket,
        notes,
        idempotency_key,
        created_by
    ) VALUES (
        'RECONCILIACAO_FALTANTE_LOCALIZADO',
        v_div.material_id,
        v_qty,
        v_load.origin_location_id,
        v_dest_loc.id,
        v_dest_bucket,
        format('Reconciliação de faltante localizado posteriormente. Carga: %s, Divergência: %s. %s', v_load.code, v_div.id, COALESCE(p_notes, '')),
        p_idempotency_key,
        v_user_id
    );

    -- Update Divergence status
    UPDATE public.divergences
    SET status = 'RESOLVIDA',
        resolution_type = 'FALTANTE_LOCALIZADO',
        resolution_notes = p_notes,
        resolved_by = v_user_id,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = v_div.id;

    -- Record History
    INSERT INTO public.divergence_history (
        divergence_id,
        action,
        from_status,
        to_status,
        notes,
        performed_by
    ) VALUES (
        v_div.id,
        'MISSING_MATERIAL_FOUND',
        v_div.status,
        'RESOLVIDA',
        format('Material localizado posteriormente (%s un). Saldo em trânsito baixado e creditado no destino. %s', v_qty, COALESCE(p_notes, '')),
        v_user_id
    );

    -- Audit
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'MISSING_MATERIAL_FOUND',
        'divergences',
        v_div.id,
        jsonb_build_object(
            'divergence_id', v_div.id,
            'quantity', v_qty,
            'destination_bucket', v_dest_bucket,
            'notes', p_notes
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', format('Material faltante (%s un) reconciliado com sucesso no destino.', v_qty)
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'RESOLVE_MISSING_MATERIAL', p_divergence_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


-- 8.3. CONFIRM MISSING MATERIAL PHYSICAL LOSS (BAIXA_FALTANTE SEM ENTRADA NO DESTINO)
CREATE OR REPLACE FUNCTION fn_confirm_missing_material(
    p_divergence_id UUID,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_div public.divergences%ROWTYPE;
    v_load public.loads%ROWTYPE;
    v_transit public.stock_in_transit_balances%ROWTYPE;
    v_qty NUMERIC;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'CONFIRM_MISSING_MATERIAL', p_divergence_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Apenas Administradores podem confirmar baixa física de faltante.';
    END IF;

    -- Lock divergence FOR UPDATE
    SELECT * INTO v_div FROM public.divergences WHERE id = p_divergence_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Divergência não encontrada: %', p_divergence_id;
    END IF;

    IF v_div.status = 'RESOLVIDA' THEN
        RAISE EXCEPTION 'Esta divergência já está resolvida.';
    END IF;

    v_qty := v_div.difference_qty;
    IF v_qty IS NULL OR v_qty <= 0 THEN
        RAISE EXCEPTION 'Quantidade faltante inválida na divergência: %', v_qty;
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = v_div.load_id;

    -- Lock in-transit balance FOR UPDATE
    SELECT * INTO v_transit
    FROM public.stock_in_transit_balances
    WHERE load_id = v_load.id
      AND material_id = v_div.material_id
      AND origin_location_id = v_load.origin_location_id
      AND destination_location_id = v_load.destination_location_id
      AND (v_div.pallet_id IS NULL OR pallet_id = v_div.pallet_id)
    FOR UPDATE;

    IF NOT FOUND OR v_transit.quantity < v_qty THEN
        RAISE EXCEPTION 'Saldo em trânsito insuficiente para baixa. Em trânsito: %, Necessário: %',
            COALESCE(v_transit.quantity, 0), v_qty;
    END IF;

    -- Decrement/Zero in-transit balance
    IF v_transit.quantity = v_qty THEN
        DELETE FROM public.stock_in_transit_balances WHERE id = v_transit.id;
    ELSE
        UPDATE public.stock_in_transit_balances
        SET quantity = quantity - v_qty,
            updated_at = NOW()
        WHERE id = v_transit.id;
    END IF;

    -- Record physical write-off in ledger (WITHOUT destination stock creation)
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        destination_bucket,
        notes,
        idempotency_key,
        created_by
    ) VALUES (
        'BAIXA_FALTANTE',
        v_div.material_id,
        v_qty,
        v_load.origin_location_id,
        v_load.destination_location_id,
        'DISPONIVEL',
        format('Baixa física de material faltante confirmado. Carga: %s, Divergência: %s. %s', v_load.code, v_div.id, COALESCE(p_notes, '')),
        p_idempotency_key,
        v_user_id
    );

    -- Update Divergence
    UPDATE public.divergences
    SET status = 'RESOLVIDA',
        resolution_type = 'FALTA_FISICA_CONFIRMADA',
        resolution_notes = p_notes,
        resolved_by = v_user_id,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = v_div.id;

    -- History
    INSERT INTO public.divergence_history (
        divergence_id,
        action,
        from_status,
        to_status,
        notes,
        performed_by
    ) VALUES (
        v_div.id,
        'MISSING_MATERIAL_CONFIRMED',
        v_div.status,
        'RESOLVIDA',
        format('Falta física confirmada (%s un). Saldo em trânsito zerado via BAIXA_FALTANTE. %s', v_qty, COALESCE(p_notes, '')),
        v_user_id
    );

    -- Audit
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'MISSING_MATERIAL_CONFIRMED',
        'divergences',
        v_div.id,
        jsonb_build_object(
            'divergence_id', v_div.id,
            'quantity', v_qty,
            'notes', p_notes
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', format('Falta física confirmada e trânsito (%s un) baixado com sucesso.', v_qty)
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'CONFIRM_MISSING_MATERIAL', p_divergence_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


-- 8.4. CREATE FINANCIAL LOSS DECISION (WITH IMMUTABLE HISTORICAL SNAPSHOT & RATE ENFORCEMENT)
CREATE OR REPLACE FUNCTION fn_create_loss(
    p_divergence_id UUID,
    p_work_id UUID,
    p_supplier_id UUID,
    p_material_id UUID,
    p_quantity NUMERIC,
    p_responsible_type TEXT,
    p_responsible_reference_id UUID,
    p_reason TEXT,
    p_agreement_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_mat public.materials%ROWTYPE;
    v_div public.divergences%ROWTYPE;
    v_rate NUMERIC;
    v_unit_area NUMERIC;
    v_calc_val NUMERIC;
    v_loss_id UUID;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'CREATE_LOSS', p_divergence_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Apenas Administradores podem registrar perdas financeiras.';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
        RAISE EXCEPTION 'Quantidade de perda deve ser um número inteiro positivo: %', p_quantity;
    END IF;

    -- Validate Material
    SELECT * INTO v_mat FROM public.materials WHERE id = p_material_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material não encontrado: %', p_material_id;
    END IF;

    v_unit_area := COALESCE(v_mat.unit_area_m2, 0);
    IF v_unit_area <= 0 THEN
        RAISE EXCEPTION 'Material % não possui área unitária (m²) cadastrada.', v_mat.code;
    END IF;

    -- If linked to a Divergence, validate eligible quantity and prevent double-counting
    IF p_divergence_id IS NOT NULL THEN
        SELECT * INTO v_div FROM public.divergences WHERE id = p_divergence_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Divergência não encontrada: %', p_divergence_id;
        END IF;

        IF (v_div.allocated_loss_qty + p_quantity) > v_div.difference_qty THEN
            RAISE EXCEPTION 'Quantidade total de perdas alocadas (%.2f) excede a quantidade da divergência (%.2f). Bloqueado contra double counting.',
                (v_div.allocated_loss_qty + p_quantity), v_div.difference_qty;
        END IF;
    END IF;

    -- Retrieve active loss rate (Rule: specific work rate -> default material rate -> block if null)
    v_rate := fn_get_loss_rate_for_material_and_work(p_material_id, p_work_id, CURRENT_DATE);
    IF v_rate IS NULL OR v_rate <= 0 THEN
        RAISE EXCEPTION 'Nenhuma taxa de perda (loss_valuation_rate) ativa encontrada para o material % e obra informada. Criação financeira bloqueada.', v_mat.code;
    END IF;

    -- Compute calculated financial loss value
    v_calc_val := ROUND(p_quantity * v_unit_area * v_rate, 2);

    -- Insert Loss Record with immutable snapshot
    INSERT INTO public.losses (
        divergence_id,
        work_id,
        supplier_id,
        material_id,
        quantity,
        responsible_type,
        responsible_reference_id,
        reason,
        status,
        applied_rate_per_m2,
        unit_area_m2_snapshot,
        calculated_value,
        agreement_notes,
        created_by
    ) VALUES (
        p_divergence_id,
        p_work_id,
        p_supplier_id,
        p_material_id,
        p_quantity,
        p_responsible_type,
        p_responsible_reference_id,
        p_reason,
        'PENDENTE',
        v_rate,
        v_unit_area,
        v_calc_val,
        p_agreement_notes,
        v_user_id
    ) RETURNING id INTO v_loss_id;

    -- Update Divergence allocated quantity if linked
    IF p_divergence_id IS NOT NULL THEN
        UPDATE public.divergences
        SET allocated_loss_qty = allocated_loss_qty + p_quantity,
            updated_at = NOW()
        WHERE id = p_divergence_id;

        INSERT INTO public.divergence_history (
            divergence_id,
            action,
            notes,
            performed_by
        ) VALUES (
            p_divergence_id,
            'LOSS_CREATED',
            format('Encaminhado para perda financeira (ID: %s, %s un, R$ %s).', v_loss_id, p_quantity, v_calc_val),
            v_user_id
        );
    END IF;

    -- Audit
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'LOSS_CREATED',
        'losses',
        v_loss_id,
        jsonb_build_object(
            'loss_id', v_loss_id,
            'divergence_id', p_divergence_id,
            'material_id', p_material_id,
            'quantity', p_quantity,
            'unit_area_m2_snapshot', v_unit_area,
            'applied_rate_per_m2', v_rate,
            'calculated_value', v_calc_val
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Perda financeira registrada com sucesso.',
        'loss_id', v_loss_id,
        'calculated_value', v_calc_val,
        'applied_rate_per_m2', v_rate
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'CREATE_LOSS', p_divergence_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


-- 8.5. SCRAP MOVEMENT REQUEST & APPROVAL RPCS
CREATE OR REPLACE FUNCTION fn_request_scrap_movement(
    p_origin_location_id UUID,
    p_destination_location_id UUID,
    p_material_id UUID,
    p_quantity NUMERIC,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_stock_rec public.stock_balances%ROWTYPE;
    v_req_id UUID;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'REQUEST_SCRAP_MOVEMENT', p_origin_location_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
        RAISE EXCEPTION 'Quantidade de sucata deve ser um número inteiro positivo: %', p_quantity;
    END IF;

    -- Validate user authorization for origin location
    IF v_user_role <> 'ADMINISTRADOR' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = p_origin_location_id
        ) THEN
            RAISE EXCEPTION 'Usuário não tem acesso à localização de origem da sucata.';
        END IF;
    END IF;

    -- Validate available scrap balance
    SELECT * INTO v_stock_rec
    FROM public.stock_balances
    WHERE location_id = p_origin_location_id
      AND material_id = p_material_id
      AND bucket = 'SUCATA';

    IF NOT FOUND OR v_stock_rec.quantity < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente no bucket SUCATA. Disponível: %, Solicitado: %',
            COALESCE(v_stock_rec.quantity, 0), p_quantity;
    END IF;

    INSERT INTO public.scrap_movement_requests (
        origin_location_id,
        destination_location_id,
        material_id,
        quantity,
        status,
        requested_by,
        requested_at,
        notes
    ) VALUES (
        p_origin_location_id,
        p_destination_location_id,
        p_material_id,
        p_quantity,
        'PENDENTE',
        v_user_id,
        NOW(),
        p_notes
    ) RETURNING id INTO v_req_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'SCRAP_MOVEMENT_REQUESTED',
        'scrap_movement_requests',
        v_req_id,
        jsonb_build_object(
            'request_id', v_req_id,
            'origin_location_id', p_origin_location_id,
            'destination_location_id', p_destination_location_id,
            'material_id', p_material_id,
            'quantity', p_quantity
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Solicitação de movimentação de sucata criada com sucesso (Aguardando Aprovação Administrativa).',
        'request_id', v_req_id
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'REQUEST_SCRAP_MOVEMENT', p_origin_location_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION fn_approve_scrap_movement(
    p_request_id UUID,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_req public.scrap_movement_requests%ROWTYPE;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'APPROVE_SCRAP_MOVEMENT', p_request_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Apenas Administradores podem aprovar solicitações de movimentação de sucata. (Analistas e Fornecedores bloqueados)';
    END IF;

    SELECT * INTO v_req FROM public.scrap_movement_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação de movimentação de sucata não encontrada: %', p_request_id;
    END IF;

    IF v_req.status <> 'PENDENTE' THEN
        RAISE EXCEPTION 'Solicitação não está em estado PENDENTE (Status atual: %)', v_req.status;
    END IF;

    -- 1. Anti-Double Allocation: Check physical SUCATA and already approved unexecuted quantity
    DECLARE
        v_physical_sucata NUMERIC(12, 2) := 0;
        v_already_approved_qty NUMERIC(12, 2) := 0;
    BEGIN
        SELECT COALESCE(quantity, 0) INTO v_physical_sucata
        FROM public.stock_balances
        WHERE location_id = v_req.origin_location_id
          AND material_id = v_req.material_id
          AND bucket = 'SUCATA'
        FOR UPDATE;

        IF v_physical_sucata IS NULL OR v_physical_sucata <= 0 THEN
            RAISE EXCEPTION 'Saldo físico de SUCATA inexistente no local de origem (Saldo: 0).';
        END IF;

        -- Sum all other currently APROVADA (unexecuted) requests for this origin and material
        SELECT COALESCE(SUM(quantity), 0) INTO v_already_approved_qty
        FROM public.scrap_movement_requests
        WHERE origin_location_id = v_req.origin_location_id
          AND material_id = v_req.material_id
          AND status = 'APROVADA'
          AND id <> p_request_id;

        IF (v_already_approved_qty + v_req.quantity) > v_physical_sucata THEN
            RAISE EXCEPTION 'Saldo de SUCATA insuficiente para aprovar. Saldo Físico: %, Já Aprovado/Reservado em outras solicitações: %, Solicitado nesta: % (Excedente de % peças).',
                v_physical_sucata, v_already_approved_qty, v_req.quantity,
                (v_already_approved_qty + v_req.quantity - v_physical_sucata);
        END IF;
    END;

    UPDATE public.scrap_movement_requests
    SET status = 'APROVADA',
        approved_by = v_user_id,
        approved_at = NOW(),
        notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || ' | ', '') || p_notes ELSE notes END,
        updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'SCRAP_MOVEMENT_APPROVED',
        'scrap_movement_requests',
        p_request_id,
        jsonb_build_object('request_id', p_request_id, 'approved_by', v_user_id)
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Solicitação de movimentação de sucata aprovada. Material liberado para transporte logístico.'
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'APPROVE_SCRAP_MOVEMENT', p_request_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION fn_reject_scrap_movement(
    p_request_id UUID,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_cached_result JSONB;
    v_user_id UUID;
    v_user_role user_system_role;
    v_req public.scrap_movement_requests%ROWTYPE;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_cached_result := fn_check_idempotency(p_idempotency_key, 'REJECT_SCRAP_MOVEMENT', p_request_id);
        IF v_cached_result IS NOT NULL THEN
            RETURN v_cached_result;
        END IF;
    END IF;

    v_user_id := auth.uid();
    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Apenas Administradores podem rejeitar solicitações de movimentação de sucata.';
    END IF;

    SELECT * INTO v_req FROM public.scrap_movement_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação de movimentação de sucata não encontrada: %', p_request_id;
    END IF;

    IF v_req.status <> 'PENDENTE' THEN
        RAISE EXCEPTION 'Solicitação não está em estado PENDENTE (Status atual: %)', v_req.status;
    END IF;

    UPDATE public.scrap_movement_requests
    SET status = 'REJEITADA',
        rejected_by = v_user_id,
        rejected_at = NOW(),
        notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || ' | ', '') || p_notes ELSE notes END,
        updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        v_user_id,
        'SCRAP_MOVEMENT_REJECTED',
        'scrap_movement_requests',
        p_request_id,
        jsonb_build_object('request_id', p_request_id, 'rejected_by', v_user_id, 'notes', p_notes)
    );

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Solicitação de movimentação de sucata rejeitada.'
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        PERFORM fn_save_idempotency(p_idempotency_key, 'REJECT_SCRAP_MOVEMENT', p_request_id, v_result);
    END IF;

    RETURN v_result;
END;
$$;

-- Link approved scrap movement request to an active load
CREATE OR REPLACE FUNCTION fn_link_scrap_movement_to_load(
    p_request_id UUID,
    p_load_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_req public.scrap_movement_requests%ROWTYPE;
    v_load public.loads%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM public.scrap_movement_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação de sucata não encontrada: %', p_request_id;
    END IF;

    IF v_req.status <> 'APROVADA' THEN
        RAISE EXCEPTION 'Apenas solicitações com status APROVADA podem ser vinculadas a cargas (Status atual: %)', v_req.status;
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada: %', p_load_id;
    END IF;

    IF v_load.origin_location_id <> v_req.origin_location_id OR v_load.destination_location_id <> v_req.destination_location_id THEN
        RAISE EXCEPTION 'Origem e destino da carga divergem da solicitação de sucata.';
    END IF;

    UPDATE public.scrap_movement_requests
    SET load_id = p_load_id,
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Solicitação de sucata vinculada à carga com sucesso.');
END;
$$;

-- Finalize scrap movement request execution upon load delivery and conference completion
CREATE OR REPLACE FUNCTION fn_finalize_scrap_movement_execution(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_req public.scrap_movement_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM public.scrap_movement_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação de sucata não encontrada: %', p_request_id;
    END IF;

    IF v_req.status <> 'APROVADA' THEN
        RAISE EXCEPTION 'Apenas solicitações APROVADAS podem ser executadas (Status atual: %)', v_req.status;
    END IF;

    UPDATE public.scrap_movement_requests
    SET status = 'EXECUTADA',
        executed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Movimentação de sucata marcada como EXECUTADA após recebimento físico no destino.');
END;
$$;
