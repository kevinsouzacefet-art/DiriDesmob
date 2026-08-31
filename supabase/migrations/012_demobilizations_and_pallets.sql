-- ============================================================================
-- 012_DEMOBILIZATIONS_AND_PALLETS.SQL
-- DiriDesmob Phase 2.3 - Demobilizations, Pallets & Transactional Stock Reservation
-- ============================================================================

-- 1. ENUMS & ENUM EXTENSIONS
DO $$ BEGIN
    CREATE TYPE demobilization_status AS ENUM (
        'DISPONIVEL',
        'EM_DESMOBILIZACAO',
        'PARCIALMENTE_DESMOBILIZADA',
        'DESMOBILIZADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Extend pallet_status enum with required statuses
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'PRONTO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'RESERVADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'EM_CARGA';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'ENVIADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'CONFERIDO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'FINALIZADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend stock_movement_type enum with RESERVA_PALLET and LIBERACAO_PALLET
DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RESERVA_PALLET';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'LIBERACAO_PALLET';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. DEMOBILIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.demobilizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE RESTRICT,
    target_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status demobilization_status NOT NULL DEFAULT 'DISPONIVEL',
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enabled_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demobilizations_work ON public.demobilizations(work_id);
CREATE INDEX IF NOT EXISTS idx_demobilizations_target ON public.demobilizations(target_location_id);
CREATE INDEX IF NOT EXISTS idx_demobilizations_status ON public.demobilizations(status);

DROP TRIGGER IF EXISTS trg_demobilizations_updated_at ON public.demobilizations;
CREATE TRIGGER trg_demobilizations_updated_at
BEFORE UPDATE ON public.demobilizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. SEQUENCE AND PALLET CODE GENERATOR (DES-000001)
CREATE SEQUENCE IF NOT EXISTS demob_pallet_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_demob_pallet_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'DES-' || LPAD(nextval('demob_pallet_code_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. DEMOBILIZATION PALLETS TABLE
CREATE TABLE IF NOT EXISTS public.demobilization_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE DEFAULT generate_demob_pallet_code(),
    demobilization_id UUID NOT NULL REFERENCES public.demobilizations(id) ON DELETE RESTRICT,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status pallet_status NOT NULL DEFAULT 'EM_MONTAGEM',
    created_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case table already existed from earlier schema without demobilization_id
ALTER TABLE public.demobilization_pallets
ADD COLUMN IF NOT EXISTS demobilization_id UUID REFERENCES public.demobilizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_demob_pallets_demob ON public.demobilization_pallets(demobilization_id);
CREATE INDEX IF NOT EXISTS idx_demob_pallets_origin ON public.demobilization_pallets(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_demob_pallets_status ON public.demobilization_pallets(status);
CREATE INDEX IF NOT EXISTS idx_demob_pallets_code ON public.demobilization_pallets(code);

DROP TRIGGER IF EXISTS trg_demob_pallets_updated_at ON public.demobilization_pallets;
CREATE TRIGGER trg_demob_pallets_updated_at
BEFORE UPDATE ON public.demobilization_pallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. DEMOBILIZATION PALLET ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.demobilization_pallet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0 AND quantity = trunc(quantity)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_demob_pallet_material UNIQUE (pallet_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_demob_pallet_items_pallet ON public.demobilization_pallet_items(pallet_id);
CREATE INDEX IF NOT EXISTS idx_demob_pallet_items_material ON public.demobilization_pallet_items(material_id);

DROP TRIGGER IF EXISTS trg_demob_pallet_items_updated_at ON public.demobilization_pallet_items;
CREATE TRIGGER trg_demob_pallet_items_updated_at
BEFORE UPDATE ON public.demobilization_pallet_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. EXTEND STOCK MOVEMENTS FOR BUCKET AND DEMOBILIZATION TRACKING
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS source_bucket stock_bucket,
ADD COLUMN IF NOT EXISTS demobilization_id UUID REFERENCES public.demobilizations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS demobilization_pallet_id UUID REFERENCES public.demobilization_pallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_demob ON public.stock_movements(demobilization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_demob_pallet ON public.stock_movements(demobilization_pallet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_buckets ON public.stock_movements(source_bucket, destination_bucket);

-- 7. RLS POLICIES (Read for Admin/Analyst + Authorized Obra; Write strictly blocked for direct table manipulation)
ALTER TABLE public.demobilizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demobilization_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demobilization_pallet_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_demob_sel" ON public.demobilizations;
CREATE POLICY "p_demob_sel" ON public.demobilizations
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR (
        auth_user_role() IN ('OBRA_SUPERVISOR', 'OBRA_CONFERENTE')
        AND EXISTS (
            SELECT 1 FROM public.user_location_access ula
            WHERE ula.user_id = auth.uid()
              AND ula.location_id = demobilizations.work_id
        )
    )
);

DROP POLICY IF EXISTS "p_demob_block_write" ON public.demobilizations;
CREATE POLICY "p_demob_block_write" ON public.demobilizations
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "p_demob_pallets_sel" ON public.demobilization_pallets;
CREATE POLICY "p_demob_pallets_sel" ON public.demobilization_pallets
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR (
        auth_user_role() IN ('OBRA_SUPERVISOR', 'OBRA_CONFERENTE')
        AND EXISTS (
            SELECT 1 FROM public.user_location_access ula
            WHERE ula.user_id = auth.uid()
              AND ula.location_id = demobilization_pallets.origin_location_id
        )
    )
);

DROP POLICY IF EXISTS "p_demob_pallets_block_write" ON public.demobilization_pallets;
CREATE POLICY "p_demob_pallets_block_write" ON public.demobilization_pallets
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "p_demob_items_sel" ON public.demobilization_pallet_items;
CREATE POLICY "p_demob_items_sel" ON public.demobilization_pallet_items
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.demobilization_pallets p
        JOIN public.user_location_access ula ON ula.location_id = p.origin_location_id
        WHERE p.id = demobilization_pallet_items.pallet_id
          AND ula.user_id = auth.uid()
          AND auth_user_role() IN ('OBRA_SUPERVISOR', 'OBRA_CONFERENTE')
    )
);

DROP POLICY IF EXISTS "p_demob_items_block_write" ON public.demobilization_pallet_items;
CREATE POLICY "p_demob_items_block_write" ON public.demobilization_pallet_items
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- ============================================================================
-- 8. TRANSACTIONAL SECURITY DEFINER RPCS
-- ============================================================================

-- A. RPC: ENABLE WORK DEMOBILIZATION
CREATE OR REPLACE FUNCTION fn_enable_work_demobilization(
    p_work_id UUID,
    p_target_location_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_work RECORD;
    v_target RECORD;
    v_demob_id UUID;
    v_status demobilization_status;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Administradores podem habilitar obras para desmobilização.';
    END IF;

    SELECT * INTO v_work FROM public.locations WHERE id = p_work_id AND type = 'OBRA' AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Obra não encontrada ou inativa: %', p_work_id;
    END IF;

    IF p_target_location_id IS NOT NULL THEN
        SELECT * INTO v_target FROM public.locations WHERE id = p_target_location_id AND is_active = TRUE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Destino previsto não encontrado ou inativo: %', p_target_location_id;
        END IF;
    END IF;

    -- Upsert demobilization record
    INSERT INTO public.demobilizations (
        work_id,
        target_location_id,
        status,
        enabled_at,
        enabled_by,
        notes,
        created_at,
        updated_at
    ) VALUES (
        p_work_id,
        p_target_location_id,
        'DISPONIVEL',
        NOW(),
        v_user_id,
        p_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (work_id) DO UPDATE SET
        target_location_id = COALESCE(EXCLUDED.target_location_id, public.demobilizations.target_location_id),
        notes = COALESCE(EXCLUDED.notes, public.demobilizations.notes),
        updated_at = NOW()
    RETURNING id, status INTO v_demob_id, v_status;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOBILIZATION_ENABLE',
        'demobilizations',
        v_demob_id,
        jsonb_build_object(
            'work_id', p_work_id,
            'target_location_id', p_target_location_id,
            'status', v_status,
            'notes', p_notes
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'demobilization_id', v_demob_id,
        'work_id', p_work_id,
        'status', v_status,
        'target_location_id', p_target_location_id
    );
END;
$$;

-- B. RPC: UPDATE DEMOBILIZATION TARGET LOCATION
CREATE OR REPLACE FUNCTION fn_update_demobilization_target(
    p_demobilization_id UUID,
    p_target_location_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_demob RECORD;
    v_target RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Administradores podem alterar o destino previsto da desmobilização.';
    END IF;

    SELECT * INTO v_demob FROM public.demobilizations WHERE id = p_demobilization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Desmobilização não encontrada: %', p_demobilization_id;
    END IF;

    IF p_target_location_id IS NOT NULL THEN
        SELECT * INTO v_target FROM public.locations WHERE id = p_target_location_id AND is_active = TRUE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Destino previsto não encontrado ou inativo: %', p_target_location_id;
        END IF;
    END IF;

    UPDATE public.demobilizations
    SET 
        target_location_id = p_target_location_id,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_demobilization_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOBILIZATION_TARGET_UPDATE',
        'demobilizations',
        p_demobilization_id,
        jsonb_build_object('target_location_id', v_demob.target_location_id),
        jsonb_build_object('target_location_id', p_target_location_id, 'notes', p_notes),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'demobilization_id', p_demobilization_id,
        'target_location_id', p_target_location_id
    );
END;
$$;

-- C. RPC: CREATE DEMOBILIZATION PALLET
CREATE OR REPLACE FUNCTION fn_create_demobilization_pallet(
    p_demobilization_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_demob RECORD;
    v_pallet_id UUID;
    v_code TEXT;
    v_has_access BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    SELECT * INTO v_demob FROM public.demobilizations WHERE id = p_demobilization_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Desmobilização não encontrada: %', p_demobilization_id;
    END IF;

    IF v_demob.status = 'DESMOBILIZADA' THEN
        RAISE EXCEPTION 'Esta obra já foi totalmente desmobilizada. Não é permitido criar novos pallets.';
    END IF;

    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_demob.work_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não possui acesso autorizado à obra desta desmobilização.';
        END IF;
    END IF;

    -- Generate Unique Pallet Code
    v_code := generate_demob_pallet_code();

    INSERT INTO public.demobilization_pallets (
        code,
        demobilization_id,
        origin_location_id,
        destination_location_id,
        status,
        notes,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_code,
        p_demobilization_id,
        v_demob.work_id,
        v_demob.target_location_id,
        'EM_MONTAGEM',
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_pallet_id;

    -- Update demobilization state to EM_DESMOBILIZACAO if it was DISPONIVEL
    IF v_demob.status = 'DISPONIVEL' THEN
        UPDATE public.demobilizations
        SET status = 'EM_DESMOBILIZACAO', updated_at = NOW()
        WHERE id = p_demobilization_id;
    END IF;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_CREATE',
        'demobilization_pallets',
        v_pallet_id,
        jsonb_build_object(
            'pallet_id', v_pallet_id,
            'code', v_code,
            'demobilization_id', p_demobilization_id,
            'origin_location_id', v_demob.work_id,
            'status', 'EM_MONTAGEM'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'pallet_id', v_pallet_id,
        'code', v_code,
        'status', 'EM_MONTAGEM',
        'demobilization_id', p_demobilization_id,
        'origin_location_id', v_demob.work_id
    );
END;
$$;

-- D. RPC: ADD MATERIAL TO DEMOBILIZATION PALLET (TRANSACTIONAL STOCK RESERVATION)
CREATE OR REPLACE FUNCTION fn_add_material_to_demob_pallet(
    p_pallet_id UUID,
    p_material_id UUID,
    p_quantity NUMERIC,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_pallet RECORD;
    v_demob RECORD;
    v_material RECORD;
    v_existing_idempotency RECORD;
    v_has_access BOOLEAN;
    v_available_qty NUMERIC(12, 2);
    v_new_item_qty NUMERIC(12, 2);
    v_pallet_total_pieces NUMERIC(12, 2);
    v_pallet_total_area NUMERIC(14, 4);
    v_avail_after NUMERIC(12, 2);
    v_res_after NUMERIC(12, 2);
    v_result_payload JSONB;
BEGIN
    -- 1. Validate Authentication & Active Profile
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    -- Block Analistas from mutating stock
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    -- 2. Validate Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Validate Quantity
    IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
        RAISE EXCEPTION 'Quantidade inválida. Deve ser um número inteiro positivo: %', p_quantity;
    END IF;

    -- 4. Atomic Idempotency Reservation
    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        created_at
    ) VALUES (
        p_idempotency_key,
        'ADD_MATERIAL_TO_DEMOB_PALLET',
        'demobilization_pallet',
        p_pallet_id,
        v_user_id,
        'PROCESSING',
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'ADD_MATERIAL_TO_DEMOB_PALLET' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'demobilization_pallet' OR v_existing_idempotency.entity_id <> p_pallet_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outro pallet: %', v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 5. Lock Pallet & Validate Status
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status <> 'EM_MONTAGEM' THEN
        RAISE EXCEPTION 'Inclusão de material permitida apenas em pallets com status EM_MONTAGEM. Status atual: %', v_pallet.status;
    END IF;

    -- 6. Validate Location Access
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à obra do pallet.';
        END IF;
    END IF;

    -- 7. Validate Demobilization Consistency
    SELECT * INTO v_demob FROM public.demobilizations WHERE id = v_pallet.demobilization_id;
    IF NOT FOUND OR v_demob.work_id <> v_pallet.origin_location_id THEN
        RAISE EXCEPTION 'Inconsistência entre desmobilização e localização do pallet.';
    END IF;

    -- 8. Validate Material
    SELECT * INTO v_material FROM public.materials WHERE id = p_material_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material não encontrado ou inativo: %', p_material_id;
    END IF;

    -- 9. CRITICAL STOCK LOCK & AVAILABILITY CHECK (Bucket DISPONIVEL)
    SELECT quantity INTO v_available_qty 
    FROM public.stock_balances 
    WHERE location_id = v_pallet.origin_location_id 
      AND material_id = p_material_id 
      AND bucket = 'DISPONIVEL' 
    FOR UPDATE;

    IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente no bucket DISPONIVEL. Solicitado: %, Disponível: %', p_quantity, COALESCE(v_available_qty, 0);
    END IF;

    -- 10. ATOMIC STOCK BALANCES TRANSITION (DISPONIVEL -> RESERVADO)
    -- A. Decrement DISPONIVEL
    UPDATE public.stock_balances
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE location_id = v_pallet.origin_location_id 
      AND material_id = p_material_id 
      AND bucket = 'DISPONIVEL';

    -- B. Increment RESERVADO (UPSERT)
    INSERT INTO public.stock_balances (
        location_id,
        material_id,
        bucket,
        quantity,
        updated_at
    ) VALUES (
        v_pallet.origin_location_id,
        p_material_id,
        'RESERVADO',
        p_quantity,
        NOW()
    )
    ON CONFLICT (location_id, material_id, bucket)
    DO UPDATE SET 
        quantity = public.stock_balances.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    -- 11. ATOMIC UPSERT IN DEMOBILIZATION PALLET ITEMS
    INSERT INTO public.demobilization_pallet_items (
        pallet_id,
        material_id,
        quantity,
        created_at,
        updated_at
    ) VALUES (
        p_pallet_id,
        p_material_id,
        p_quantity,
        NOW(),
        NOW()
    )
    ON CONFLICT (pallet_id, material_id)
    DO UPDATE SET 
        quantity = public.demobilization_pallet_items.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    RETURNING quantity INTO v_new_item_qty;

    -- 12. RECORD IMMUTABLE LEDGER MOVEMENT (RESERVA_PALLET)
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        source_bucket,
        destination_bucket,
        demobilization_id,
        demobilization_pallet_id,
        idempotency_key,
        notes,
        created_by,
        created_at
    ) VALUES (
        'RESERVA_PALLET',
        p_material_id,
        p_quantity,
        v_pallet.origin_location_id,
        v_pallet.origin_location_id,
        'DISPONIVEL',
        'RESERVADO',
        v_pallet.demobilization_id,
        p_pallet_id,
        p_idempotency_key,
        'Reserva para pallet ' || v_pallet.code,
        v_user_id,
        NOW()
    );

    -- 13. Ensure Demobilization Status is EM_DESMOBILIZACAO
    IF v_demob.status = 'DISPONIVEL' THEN
        UPDATE public.demobilizations 
        SET status = 'EM_DESMOBILIZACAO', updated_at = NOW() 
        WHERE id = v_demob.id;
    END IF;

    UPDATE public.demobilization_pallets 
    SET updated_at = NOW() 
    WHERE id = p_pallet_id;

    -- 14. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_ADD_MATERIAL',
        'demobilization_pallet_items',
        p_pallet_id,
        jsonb_build_object(
            'pallet_id', p_pallet_id,
            'pallet_code', v_pallet.code,
            'material_id', p_material_id,
            'material_code', v_material.code,
            'added_quantity', p_quantity,
            'total_in_pallet', v_new_item_qty
        ),
        NOW()
    );

    -- Calculate Updated Totals
    SELECT 
        COALESCE(SUM(i.quantity), 0),
        COALESCE(SUM(i.quantity * COALESCE(m.unit_area_m2, 0)), 0)
    INTO v_pallet_total_pieces, v_pallet_total_area
    FROM public.demobilization_pallet_items i
    JOIN public.materials m ON m.id = i.material_id
    WHERE i.pallet_id = p_pallet_id;

    SELECT quantity INTO v_avail_after FROM public.stock_balances WHERE location_id = v_pallet.origin_location_id AND material_id = p_material_id AND bucket = 'DISPONIVEL';
    SELECT quantity INTO v_res_after FROM public.stock_balances WHERE location_id = v_pallet.origin_location_id AND material_id = p_material_id AND bucket = 'RESERVADO';

    v_result_payload := jsonb_build_object(
        'success', true,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'material_id', p_material_id,
        'material_code', v_material.code,
        'added_quantity', p_quantity,
        'quantity_in_pallet', v_new_item_qty,
        'pallet_total_pieces', v_pallet_total_pieces,
        'pallet_total_area_m2', v_pallet_total_area,
        'available_stock', COALESCE(v_avail_after, 0),
        'reserved_stock', COALESCE(v_res_after, 0)
    );

    -- 15. Finalize Idempotency Record
    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'ADD_MATERIAL_TO_DEMOB_PALLET'
      AND entity_type = 'demobilization_pallet'
      AND entity_id = p_pallet_id;

    RETURN v_result_payload;
END;
$$;

-- E. RPC: REMOVE MATERIAL FROM DEMOBILIZATION PALLET (RELEASE RESERVED STOCK TO DISPONIVEL)
CREATE OR REPLACE FUNCTION fn_remove_material_from_demob_pallet(
    p_pallet_id UUID,
    p_material_id UUID,
    p_quantity NUMERIC,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_pallet RECORD;
    v_item RECORD;
    v_material RECORD;
    v_existing_idempotency RECORD;
    v_has_access BOOLEAN;
    v_reserved_qty NUMERIC(12, 2);
    v_new_item_qty NUMERIC(12, 2);
    v_pallet_total_pieces NUMERIC(12, 2);
    v_pallet_total_area NUMERIC(14, 4);
    v_avail_after NUMERIC(12, 2);
    v_res_after NUMERIC(12, 2);
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication & Profile
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    -- 2. Validate Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Validate Quantity
    IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
        RAISE EXCEPTION 'Quantidade inválida. Deve ser um número inteiro positivo: %', p_quantity;
    END IF;

    -- 4. Idempotency Registration
    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        created_at
    ) VALUES (
        p_idempotency_key,
        'REMOVE_MATERIAL_FROM_DEMOB_PALLET',
        'demobilization_pallet',
        p_pallet_id,
        v_user_id,
        'PROCESSING',
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'REMOVE_MATERIAL_FROM_DEMOB_PALLET' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'demobilization_pallet' OR v_existing_idempotency.entity_id <> p_pallet_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outro pallet: %', v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 5. Lock Pallet & Validate Status
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status <> 'EM_MONTAGEM' THEN
        RAISE EXCEPTION 'Remoção de material permitida apenas em pallets com status EM_MONTAGEM. Status atual: %', v_pallet.status;
    END IF;

    -- 6. Location Access Check
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à obra do pallet.';
        END IF;
    END IF;

    -- 7. Lock & Validate Pallet Item
    SELECT * INTO v_item 
    FROM public.demobilization_pallet_items 
    WHERE pallet_id = p_pallet_id AND material_id = p_material_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material não encontrado neste pallet.';
    END IF;

    IF v_item.quantity < p_quantity THEN
        RAISE EXCEPTION 'Quantidade a remover (%) maior do que a contida no pallet (%).', p_quantity, v_item.quantity;
    END IF;

    SELECT * INTO v_material FROM public.materials WHERE id = p_material_id;

    -- 8. Lock Stock RESERVADO
    SELECT quantity INTO v_reserved_qty 
    FROM public.stock_balances 
    WHERE location_id = v_pallet.origin_location_id 
      AND material_id = p_material_id 
      AND bucket = 'RESERVADO' 
    FOR UPDATE;

    IF v_reserved_qty IS NULL OR v_reserved_qty < p_quantity THEN
        RAISE EXCEPTION 'Inconsistência de estoque: saldo RESERVADO insuficiente para liberação.';
    END IF;

    -- 9. ATOMIC STOCK BALANCES TRANSITION (RESERVADO -> DISPONIVEL)
    -- A. Decrement RESERVADO
    UPDATE public.stock_balances
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE location_id = v_pallet.origin_location_id 
      AND material_id = p_material_id 
      AND bucket = 'RESERVADO';

    -- B. Increment DISPONIVEL (UPSERT)
    INSERT INTO public.stock_balances (
        location_id,
        material_id,
        bucket,
        quantity,
        updated_at
    ) VALUES (
        v_pallet.origin_location_id,
        p_material_id,
        'DISPONIVEL',
        p_quantity,
        NOW()
    )
    ON CONFLICT (location_id, material_id, bucket)
    DO UPDATE SET 
        quantity = public.stock_balances.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    -- 10. Update or Delete Pallet Item
    IF v_item.quantity = p_quantity THEN
        DELETE FROM public.demobilization_pallet_items WHERE id = v_item.id;
        v_new_item_qty := 0;
    ELSE
        UPDATE public.demobilization_pallet_items
        SET quantity = quantity - p_quantity, updated_at = NOW()
        WHERE id = v_item.id
        RETURNING quantity INTO v_new_item_qty;
    END IF;

    -- 11. RECORD IMMUTABLE LEDGER MOVEMENT (LIBERACAO_PALLET)
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        source_bucket,
        destination_bucket,
        demobilization_id,
        demobilization_pallet_id,
        idempotency_key,
        notes,
        created_by,
        created_at
    ) VALUES (
        'LIBERACAO_PALLET',
        p_material_id,
        p_quantity,
        v_pallet.origin_location_id,
        v_pallet.origin_location_id,
        'RESERVADO',
        'DISPONIVEL',
        v_pallet.demobilization_id,
        p_pallet_id,
        p_idempotency_key,
        'Remoção de material do pallet ' || v_pallet.code,
        v_user_id,
        NOW()
    );

    UPDATE public.demobilization_pallets 
    SET updated_at = NOW() 
    WHERE id = p_pallet_id;

    -- 12. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_REMOVE_MATERIAL',
        'demobilization_pallet_items',
        p_pallet_id,
        jsonb_build_object(
            'pallet_id', p_pallet_id,
            'pallet_code', v_pallet.code,
            'material_id', p_material_id,
            'material_code', v_material.code,
            'removed_quantity', p_quantity,
            'remaining_in_pallet', v_new_item_qty
        ),
        NOW()
    );

    -- Calculate Updated Totals
    SELECT 
        COALESCE(SUM(i.quantity), 0),
        COALESCE(SUM(i.quantity * COALESCE(m.unit_area_m2, 0)), 0)
    INTO v_pallet_total_pieces, v_pallet_total_area
    FROM public.demobilization_pallet_items i
    JOIN public.materials m ON m.id = i.material_id
    WHERE i.pallet_id = p_pallet_id;

    SELECT quantity INTO v_avail_after FROM public.stock_balances WHERE location_id = v_pallet.origin_location_id AND material_id = p_material_id AND bucket = 'DISPONIVEL';
    SELECT quantity INTO v_res_after FROM public.stock_balances WHERE location_id = v_pallet.origin_location_id AND material_id = p_material_id AND bucket = 'RESERVADO';

    v_result_payload := jsonb_build_object(
        'success', true,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'material_id', p_material_id,
        'material_code', v_material.code,
        'removed_quantity', p_quantity,
        'quantity_in_pallet', v_new_item_qty,
        'pallet_total_pieces', v_pallet_total_pieces,
        'pallet_total_area_m2', v_pallet_total_area,
        'available_stock', COALESCE(v_avail_after, 0),
        'reserved_stock', COALESCE(v_res_after, 0)
    );

    -- 13. Finalize Idempotency
    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'REMOVE_MATERIAL_FROM_DEMOB_PALLET'
      AND entity_type = 'demobilization_pallet'
      AND entity_id = p_pallet_id;

    RETURN v_result_payload;
END;
$$;

-- F. RPC: MARK DEMOBILIZATION PALLET READY (PRONTO)
CREATE OR REPLACE FUNCTION fn_mark_demob_pallet_ready(
    p_pallet_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_pallet RECORD;
    v_existing_idempotency RECORD;
    v_has_access BOOLEAN;
    v_item_count INTEGER;
    v_total_pieces NUMERIC(12, 2);
    v_total_area NUMERIC(14, 4);
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    -- 2. Validate Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Idempotency Check
    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        created_at
    ) VALUES (
        p_idempotency_key,
        'MARK_DEMOB_PALLET_READY',
        'demobilization_pallet',
        p_pallet_id,
        v_user_id,
        'PROCESSING',
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'MARK_DEMOB_PALLET_READY' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'demobilization_pallet' OR v_existing_idempotency.entity_id <> p_pallet_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outro pallet: %', v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Lock Pallet
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status <> 'EM_MONTAGEM' THEN
        RAISE EXCEPTION 'Apenas pallets com status EM_MONTAGEM podem ser marcados como PRONTO. Status atual: %', v_pallet.status;
    END IF;

    -- 5. Location Access Check
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à obra do pallet.';
        END IF;
    END IF;

    -- 6. Validate Non-Empty Pallet
    SELECT 
        COUNT(*),
        COALESCE(SUM(i.quantity), 0),
        COALESCE(SUM(i.quantity * COALESCE(m.unit_area_m2, 0)), 0)
    INTO v_item_count, v_total_pieces, v_total_area
    FROM public.demobilization_pallet_items i
    JOIN public.materials m ON m.id = i.material_id
    WHERE i.pallet_id = p_pallet_id;

    IF v_item_count = 0 OR v_total_pieces <= 0 THEN
        RAISE EXCEPTION 'Não é permitido marcar como PRONTO um pallet vazio. Adicione pelo menos um material.';
    END IF;

    -- 7. Update Pallet Status to PRONTO (Stock remains RESERVADO)
    UPDATE public.demobilization_pallets
    SET status = 'PRONTO', updated_at = NOW()
    WHERE id = p_pallet_id;

    -- 8. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_MARK_READY',
        'demobilization_pallets',
        p_pallet_id,
        jsonb_build_object('status', 'EM_MONTAGEM'),
        jsonb_build_object('status', 'PRONTO', 'total_pieces', v_total_pieces, 'total_area_m2', v_total_area),
        NOW()
    );

    v_result_payload := jsonb_build_object(
        'success', true,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'status', 'PRONTO',
        'total_pieces', v_total_pieces,
        'total_area_m2', v_total_area
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'MARK_DEMOB_PALLET_READY'
      AND entity_type = 'demobilization_pallet'
      AND entity_id = p_pallet_id;

    RETURN v_result_payload;
END;
$$;

-- G. RPC: REOPEN DEMOBILIZATION PALLET (PRONTO -> EM_MONTAGEM)
CREATE OR REPLACE FUNCTION fn_reopen_demob_pallet(
    p_pallet_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_pallet RECORD;
    v_existing_idempotency RECORD;
    v_has_access BOOLEAN;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    -- 2. Validate Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Idempotency Registration
    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        created_at
    ) VALUES (
        p_idempotency_key,
        'REOPEN_DEMOB_PALLET',
        'demobilization_pallet',
        p_pallet_id,
        v_user_id,
        'PROCESSING',
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'REOPEN_DEMOB_PALLET' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'demobilization_pallet' OR v_existing_idempotency.entity_id <> p_pallet_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outro pallet: %', v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Lock Pallet
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status <> 'PRONTO' THEN
        RAISE EXCEPTION 'Apenas pallets com status PRONTO podem ser reabertos para montagem. Status atual: %', v_pallet.status;
    END IF;

    -- 5. Location Access Check
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à obra do pallet.';
        END IF;
    END IF;

    -- 6. Ensure Pallet is not associated with an active load
    IF EXISTS (
        SELECT 1 FROM public.load_pallets lp
        JOIN public.loads l ON l.id = lp.load_id
        WHERE lp.pallet_id = p_pallet_id AND l.status NOT IN ('CANCELADA')
    ) THEN
        RAISE EXCEPTION 'Este pallet já está alocado em uma carga ativa e não pode ser reaberto.';
    END IF;

    -- 7. Update Pallet Status back to EM_MONTAGEM (Stock remains RESERVADO)
    UPDATE public.demobilization_pallets
    SET status = 'EM_MONTAGEM', updated_at = NOW()
    WHERE id = p_pallet_id;

    -- 8. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_REOPEN',
        'demobilization_pallets',
        p_pallet_id,
        jsonb_build_object('status', 'PRONTO'),
        jsonb_build_object('status', 'EM_MONTAGEM'),
        NOW()
    );

    v_result_payload := jsonb_build_object(
        'success', true,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'status', 'EM_MONTAGEM'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'REOPEN_DEMOB_PALLET'
      AND entity_type = 'demobilization_pallet'
      AND entity_id = p_pallet_id;

    RETURN v_result_payload;
END;
$$;

-- H. RPC: RELEASE PALLET STOCK (DISASSEMBLE / LIBERAR PALLET)
CREATE OR REPLACE FUNCTION fn_release_pallet_stock(
    p_pallet_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_pallet RECORD;
    v_item RECORD;
    v_existing_idempotency RECORD;
    v_has_access BOOLEAN;
    v_released_items_count INTEGER := 0;
    v_released_pieces NUMERIC(12, 2) := 0;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.';
    END IF;

    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de acesso apenas de leitura.';
    END IF;

    -- 2. Validate Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Idempotency Check
    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        created_at
    ) VALUES (
        p_idempotency_key,
        'RELEASE_PALLET_STOCK',
        'demobilization_pallet',
        p_pallet_id,
        v_user_id,
        'PROCESSING',
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'RELEASE_PALLET_STOCK' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'demobilization_pallet' OR v_existing_idempotency.entity_id <> p_pallet_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outro pallet: %', v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Lock Pallet
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status NOT IN ('EM_MONTAGEM', 'PRONTO') THEN
        RAISE EXCEPTION 'Apenas pallets EM_MONTAGEM ou PRONTO podem ser desmontados/liberados. Status atual: %', v_pallet.status;
    END IF;

    -- 5. Location Access Check
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à obra do pallet.';
        END IF;
    END IF;

    -- 6. Ensure Pallet is not in active load
    IF EXISTS (
        SELECT 1 FROM public.load_pallets lp
        JOIN public.loads l ON l.id = lp.load_id
        WHERE lp.pallet_id = p_pallet_id AND l.status NOT IN ('CANCELADA')
    ) THEN
        RAISE EXCEPTION 'Este pallet está alocado em uma carga ativa e não pode ser liberado.';
    END IF;

    -- 7. Loop over all pallet items and release RESERVADO -> DISPONIVEL
    FOR v_item IN 
        SELECT * FROM public.demobilization_pallet_items 
        WHERE pallet_id = p_pallet_id 
        FOR UPDATE 
    LOOP
        -- A. Decrement RESERVADO
        UPDATE public.stock_balances
        SET quantity = quantity - v_item.quantity, updated_at = NOW()
        WHERE location_id = v_pallet.origin_location_id 
          AND material_id = v_item.material_id 
          AND bucket = 'RESERVADO';

        -- B. Increment DISPONIVEL
        INSERT INTO public.stock_balances (
            location_id,
            material_id,
            bucket,
            quantity,
            updated_at
        ) VALUES (
            v_pallet.origin_location_id,
            v_item.material_id,
            'DISPONIVEL',
            v_item.quantity,
            NOW()
        )
        ON CONFLICT (location_id, material_id, bucket)
        DO UPDATE SET 
            quantity = public.stock_balances.quantity + EXCLUDED.quantity,
            updated_at = NOW();

        -- C. Record Immutable Movement
        INSERT INTO public.stock_movements (
            movement_type,
            material_id,
            quantity,
            origin_location_id,
            destination_location_id,
            source_bucket,
            destination_bucket,
            demobilization_id,
            demobilization_pallet_id,
            idempotency_key,
            notes,
            created_by,
            created_at
        ) VALUES (
            'LIBERACAO_PALLET',
            v_item.material_id,
            v_item.quantity,
            v_pallet.origin_location_id,
            v_pallet.origin_location_id,
            'RESERVADO',
            'DISPONIVEL',
            v_pallet.demobilization_id,
            p_pallet_id,
            p_idempotency_key || '-' || v_item.id::text,
            'Desmontagem e liberação de estoque do pallet ' || v_pallet.code,
            v_user_id,
            NOW()
        );

        v_released_items_count := v_released_items_count + 1;
        v_released_pieces := v_released_pieces + v_item.quantity;
    END LOOP;

    -- 8. Delete all items from the pallet
    DELETE FROM public.demobilization_pallet_items WHERE pallet_id = p_pallet_id;

    -- 9. Mark Pallet as DESMONTADO
    UPDATE public.demobilization_pallets
    SET status = 'DESMONTADO', updated_at = NOW()
    WHERE id = p_pallet_id;

    -- 10. Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'DEMOB_PALLET_RELEASE_STOCK',
        'demobilization_pallets',
        p_pallet_id,
        jsonb_build_object('status', v_pallet.status),
        jsonb_build_object(
            'status', 'DESMONTADO',
            'released_items_count', v_released_items_count,
            'released_pieces', v_released_pieces
        ),
        NOW()
    );

    v_result_payload := jsonb_build_object(
        'success', true,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'status', 'DESMONTADO',
        'released_items_count', v_released_items_count,
        'released_pieces', v_released_pieces
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'RELEASE_PALLET_STOCK'
      AND entity_type = 'demobilization_pallet'
      AND entity_id = p_pallet_id;

    RETURN v_result_payload;
END;
$$;

-- I. RPC SYNONYM: RELEASE DEMOB PALLET STOCK (fn_release_demob_pallet_stock)
CREATE OR REPLACE FUNCTION fn_release_demob_pallet_stock(
    p_pallet_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
    RETURN fn_release_pallet_stock(p_pallet_id, p_idempotency_key);
END;
$$;

