-- ============================================================================
-- 014_LOAD_RECEIPT_AND_PALLET_CONFERENCE.SQL
-- DiriDesmob Phase 2.5 - Load Receipt, Pallet-by-Pallet Conference & Physical Stock Inflow
-- Strictly Audited, Transact Safe, Ledger Compliant & Idempotent Implementation
-- ============================================================================

-- 1. EXTEND ENUMS FOR PHASE 2.5
DO $$ BEGIN
    ALTER TYPE stock_bucket ADD VALUE IF NOT EXISTS 'AGUARDANDO_CLASSIFICACAO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RECONCILIACAO_EXCEDENTE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RECONCILIACAO_MATERIAL_DIFERENTE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. CREATE PRIVATE STORAGE BUCKET FOR DISCREPANCY PHOTOS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'discrepancy-photos',
    'discrepancy-photos',
    false,
    20971520, -- 20MB
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520;

-- 3. LOAD CONFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.load_conferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    started_by UUID REFERENCES public.profiles(id),
    finished_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_load_conferences_load UNIQUE (load_id)
);

CREATE INDEX IF NOT EXISTS idx_load_conf_load ON public.load_conferences(load_id);
CREATE INDEX IF NOT EXISTS idx_load_conf_dest ON public.load_conferences(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_load_conf_status ON public.load_conferences(status);

DROP TRIGGER IF EXISTS trg_load_conf_updated_at ON public.load_conferences;
CREATE TRIGGER trg_load_conf_updated_at
BEFORE UPDATE ON public.load_conferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. PALLET CONFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.pallet_conferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id UUID NOT NULL REFERENCES public.load_conferences(id) ON DELETE CASCADE,
    pallet_id UUID REFERENCES public.demobilization_pallets(id) ON DELETE RESTRICT,
    is_unexpected BOOLEAN NOT NULL DEFAULT FALSE,
    unexpected_code TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    started_by UUID REFERENCES public.profiles(id),
    finished_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallet_conf_conf ON public.pallet_conferences(conference_id);
CREATE INDEX IF NOT EXISTS idx_pallet_conf_pallet ON public.pallet_conferences(pallet_id);
CREATE INDEX IF NOT EXISTS idx_pallet_conf_status ON public.pallet_conferences(status);

DROP TRIGGER IF EXISTS trg_pallet_conf_updated_at ON public.pallet_conferences;
CREATE TRIGGER trg_pallet_conf_updated_at
BEFORE UPDATE ON public.pallet_conferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. PALLET CONFERENCE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.pallet_conference_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_conference_id UUID NOT NULL REFERENCES public.pallet_conferences(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    expected_qty INTEGER NOT NULL DEFAULT 0 CHECK (expected_qty >= 0),
    received_qty INTEGER CHECK (received_qty IS NULL OR received_qty >= 0),
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    is_unexpected BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pallet_conf_item UNIQUE (pallet_conference_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_pallet_conf_items_conf ON public.pallet_conference_items(pallet_conference_id);
CREATE INDEX IF NOT EXISTS idx_pallet_conf_items_mat ON public.pallet_conference_items(material_id);

DROP TRIGGER IF EXISTS trg_pallet_conf_items_updated_at ON public.pallet_conference_items;
CREATE TRIGGER trg_pallet_conf_items_updated_at
BEFORE UPDATE ON public.pallet_conference_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. DIVERGENCES TABLE (CREATE IF NOT EXISTS OR EXTEND)
CREATE TABLE IF NOT EXISTS public.divergences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    conference_id UUID REFERENCES public.load_conferences(id) ON DELETE SET NULL,
    pallet_conference_id UUID REFERENCES public.pallet_conferences(id) ON DELETE SET NULL,
    pallet_id UUID REFERENCES public.demobilization_pallets(id) ON DELETE SET NULL,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'FALTANTE',
        'SUCATA',
        'MATERIAL_DIFERENTE',
        'PALLET_DIFERENTE',
        'PALLET_DANIFICADO',
        'OUTRO',
        'EXCEDENTE_DE_ORIGEM',
        'FALTA',
        'SOBRA',
        'AVARIA',
        'ITEM_TROCADO'
    )),
    expected_qty NUMERIC(12, 2),
    received_qty NUMERIC(12, 2),
    difference_qty NUMERIC(12, 2),
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'CONTESTADA', 'RESOLVIDA', 'ABERTA', 'REJEITADA')),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on divergences table if previously created
ALTER TABLE public.divergences
ADD COLUMN IF NOT EXISTS conference_id UUID REFERENCES public.load_conferences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pallet_conference_id UUID REFERENCES public.pallet_conferences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pallet_id UUID REFERENCES public.demobilization_pallets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS expected_qty NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS received_qty NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS difference_qty NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_divergences_load ON public.divergences(load_id);
CREATE INDEX IF NOT EXISTS idx_divergences_conf ON public.divergences(conference_id);
CREATE INDEX IF NOT EXISTS idx_divergences_pallet ON public.divergences(pallet_id);
CREATE INDEX IF NOT EXISTS idx_divergences_mat ON public.divergences(material_id);
CREATE INDEX IF NOT EXISTS idx_divergences_status ON public.divergences(status);

DROP TRIGGER IF EXISTS trg_divergences_updated_at ON public.divergences;
CREATE TRIGGER trg_divergences_updated_at
BEFORE UPDATE ON public.divergences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. DISCREPANCY PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.discrepancy_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    divergence_id UUID NOT NULL REFERENCES public.divergences(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disc_photos_div ON public.discrepancy_photos(divergence_id);

-- ============================================================================
-- 8. SECURITY & RLS POLICIES
-- ============================================================================

ALTER TABLE public.load_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_conference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divergences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discrepancy_photos ENABLE ROW LEVEL SECURITY;

-- LOAD CONFERENCES POLICIES
DROP POLICY IF EXISTS "p_load_conf_select" ON public.load_conferences;
CREATE POLICY "p_load_conf_select" ON public.load_conferences
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid()
          AND (ula.location_id = load_conferences.destination_location_id 
               OR ula.location_id = (SELECT origin_location_id FROM public.loads WHERE id = load_conferences.load_id))
    )
);

-- PALLET CONFERENCES POLICIES
DROP POLICY IF EXISTS "p_pallet_conf_select" ON public.pallet_conferences;
CREATE POLICY "p_pallet_conf_select" ON public.pallet_conferences
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.load_conferences lc
        JOIN public.user_location_access ula ON ula.location_id = lc.destination_location_id
        WHERE lc.id = pallet_conferences.conference_id AND ula.user_id = auth.uid()
    )
);

-- PALLET CONFERENCE ITEMS POLICIES
DROP POLICY IF EXISTS "p_pallet_conf_items_select" ON public.pallet_conference_items;
CREATE POLICY "p_pallet_conf_items_select" ON public.pallet_conference_items
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.pallet_conferences pc
        JOIN public.load_conferences lc ON lc.id = pc.conference_id
        JOIN public.user_location_access ula ON ula.location_id = lc.destination_location_id
        WHERE pc.id = pallet_conference_items.pallet_conference_id AND ula.user_id = auth.uid()
    )
);

-- DIVERGENCES POLICIES
DROP POLICY IF EXISTS "p_divergences_select" ON public.divergences;
CREATE POLICY "p_divergences_select" ON public.divergences
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.loads l
        JOIN public.user_location_access ula ON ula.location_id = l.destination_location_id OR ula.location_id = l.origin_location_id
        WHERE l.id = divergences.load_id AND ula.user_id = auth.uid()
    )
);

-- DISCREPANCY PHOTOS POLICIES
DROP POLICY IF EXISTS "p_disc_photos_select" ON public.discrepancy_photos;
CREATE POLICY "p_disc_photos_select" ON public.discrepancy_photos
FOR SELECT TO authenticated
USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.divergences d
        JOIN public.loads l ON l.id = d.load_id
        JOIN public.user_location_access ula ON ula.location_id = l.destination_location_id OR ula.location_id = l.origin_location_id
        WHERE d.id = discrepancy_photos.divergence_id AND ula.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "p_disc_photos_insert" ON public.discrepancy_photos;
CREATE POLICY "p_disc_photos_insert" ON public.discrepancy_photos
FOR INSERT TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
);

-- STORAGE POLICIES FOR discrepancy-photos
DROP POLICY IF EXISTS "p_storage_disc_photos_sel" ON storage.objects;
CREATE POLICY "p_storage_disc_photos_sel" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'discrepancy-photos'
);

DROP POLICY IF EXISTS "p_storage_disc_photos_ins" ON storage.objects;
CREATE POLICY "p_storage_disc_photos_ins" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'discrepancy-photos'
);

-- ============================================================================
-- 9. TRANSACTIONAL RPCS (SECURITY DEFINER WITH STRICT CONCURRENCY CONTROLS)
-- ============================================================================

-- A. RPC: RECEIVE LOAD (fn_receive_load)
-- Validates: auth.uid(), destination access, load status = 'EM_TRANSITO'
-- Transitions load to 'RECEBIDA', pallets to 'RECEBIDO'
-- In-transit stock remains segregated in stock_in_transit_balances!
CREATE OR REPLACE FUNCTION fn_receive_load(
    p_load_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARATION
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_pallets_updated_count INTEGER := 0;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de leitura e não podem receber cargas.';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'RECEIVE_LOAD',
        'load',
        p_load_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'RECEIVE_LOAD' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock and validate Load
    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status <> 'EM_TRANSITO' THEN
        RAISE EXCEPTION 'Apenas cargas em trânsito podem ser recebidas (status atual: %).', v_load.status;
    END IF;

    -- 4. Validate Destination Location Access (Origin user cannot receive at destination)
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Apenas usuários autorizados na localização de destino podem receber esta carga.';
    END IF;

    -- 5. Update Load Status: EM_TRANSITO -> RECEBIDA
    UPDATE public.loads
    SET status = 'RECEBIDA',
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 6. Update Pallets Status: ENVIADO -> RECEBIDO
    UPDATE public.demobilization_pallets
    SET status = 'RECEBIDO',
        updated_at = NOW()
    WHERE id IN (
        SELECT pallet_id FROM public.load_pallets WHERE load_id = p_load_id AND is_active = TRUE
    );

    GET DIAGNOSTICS v_pallets_updated_count = ROW_COUNT;

    -- 7. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'LOAD_RECEIVED',
        'loads',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'code', v_load.code,
            'status', 'RECEBIDA',
            'pallets_count', v_pallets_updated_count,
            'received_at', NOW()
        ),
        NOW()
    );

    -- 8. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'code', v_load.code,
        'status', 'RECEBIDA',
        'pallets_count', v_pallets_updated_count,
        'received_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- B. RPC: START LOAD CONFERENCE (fn_start_load_conference)
-- Validates: load = 'RECEBIDA', destination user access
-- Transitions load to 'EM_CONFERENCIA'
-- Creates load_conferences, pallet_conferences and pre-populates expected items with received_qty = NULL
CREATE OR REPLACE FUNCTION fn_start_load_conference(
    p_load_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_conf_id UUID;
    v_pallet_rec RECORD;
    v_pallet_conf_id UUID;
    v_item_rec RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem iniciar conferências.';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'START_LOAD_CONFERENCE',
        'load',
        p_load_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'START_LOAD_CONFERENCE' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock and validate Load
    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status <> 'RECEBIDA' AND v_load.status <> 'EM_CONFERENCIA' THEN
        RAISE EXCEPTION 'Apenas cargas com status RECEBIDA podem iniciar conferência (status atual: %).', v_load.status;
    END IF;

    -- 4. Validate Destination Location Access
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não possui autorização no destino da carga.';
    END IF;

    -- 5. Create or Get Load Conference
    INSERT INTO public.load_conferences (
        load_id,
        destination_location_id,
        status,
        started_at,
        started_by,
        created_at,
        updated_at
    ) VALUES (
        p_load_id,
        v_load.destination_location_id,
        'EM_ANDAMENTO',
        NOW(),
        v_user_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (load_id) DO UPDATE SET
        status = 'EM_ANDAMENTO',
        updated_at = NOW()
    RETURNING id INTO v_conf_id;

    -- 6. Update Load status to EM_CONFERENCIA
    UPDATE public.loads
    SET status = 'EM_CONFERENCIA',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 7. Initialize Pallet Conferences and Items for each active pallet
    FOR v_pallet_rec IN
        SELECT lp.pallet_id, p.code AS pallet_code
        FROM public.load_pallets lp
        JOIN public.demobilization_pallets p ON p.id = lp.pallet_id
        WHERE lp.load_id = p_load_id AND lp.is_active = TRUE
    LOOP
        INSERT INTO public.pallet_conferences (
            conference_id,
            pallet_id,
            is_unexpected,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_conf_id,
            v_pallet_rec.pallet_id,
            FALSE,
            'PENDENTE',
            NOW(),
            NOW()
        )
        ON CONFLICT (conference_id, pallet_id) DO UPDATE SET
            updated_at = NOW()
        RETURNING id INTO v_pallet_conf_id;

        -- Pre-populate items with expected quantity from demobilization_pallet_items
        -- CRITICAL: received_qty is NULL, is_checked is FALSE
        FOR v_item_rec IN
            SELECT dpi.material_id, dpi.quantity
            FROM public.demobilization_pallet_items dpi
            WHERE dpi.pallet_id = v_pallet_rec.pallet_id
        LOOP
            INSERT INTO public.pallet_conference_items (
                pallet_conference_id,
                material_id,
                expected_qty,
                received_qty,
                is_checked,
                is_unexpected,
                created_at,
                updated_at
            ) VALUES (
                v_pallet_conf_id,
                v_item_rec.material_id,
                v_item_rec.quantity::INTEGER,
                NULL,
                FALSE,
                FALSE,
                NOW(),
                NOW()
            )
            ON CONFLICT (pallet_conference_id, material_id) DO NOTHING;
        END LOOP;
    END LOOP;

    -- 8. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'LOAD_CONFERENCE_STARTED',
        'load_conferences',
        v_conf_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'conference_id', v_conf_id,
            'started_at', NOW()
        ),
        NOW()
    );

    -- 9. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'conference_id', v_conf_id,
        'status', 'EM_CONFERENCIA',
        'started_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- C. RPC: START PALLET CONFERENCE (fn_start_pallet_conference)
-- Transitions pallet conference to 'EM_ANDAMENTO' and starts its individual timer
CREATE OR REPLACE FUNCTION fn_start_pallet_conference(
    p_pallet_conference_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_pallet_conf RECORD;
    v_conf RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem conferir pallets.';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'START_PALLET_CONFERENCE',
        'pallet_conference',
        p_pallet_conference_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'START_PALLET_CONFERENCE' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock and validate Pallet Conference
    SELECT * INTO v_pallet_conf FROM public.pallet_conferences WHERE id = p_pallet_conference_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência de pallet não encontrada.';
    END IF;

    IF v_pallet_conf.status = 'CONCLUIDA' THEN
        RAISE EXCEPTION 'Este pallet já teve sua conferência concluída.';
    END IF;

    -- 4. Validate Load Conference
    SELECT * INTO v_conf FROM public.load_conferences WHERE id = v_pallet_conf.conference_id;
    IF NOT FOUND OR v_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'A conferência geral da carga não está em andamento.';
    END IF;

    -- 5. Validate Destination Access
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_conf.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso ao destino desta carga.';
    END IF;

    -- 6. Start Pallet Conference Timer
    UPDATE public.pallet_conferences
    SET status = 'EM_ANDAMENTO',
        started_at = COALESCE(started_at, NOW()),
        started_by = COALESCE(started_by, v_user_id),
        updated_at = NOW()
    WHERE id = p_pallet_conference_id;

    -- 7. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'pallet_conference_id', p_pallet_conference_id,
        'status', 'EM_ANDAMENTO',
        'started_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- D. RPC: SET CONFERENCE ITEM RECEIVED QUANTITY (fn_set_conference_item_received_qty)
-- Manually records the checked physical quantity. ZERO is a valid quantity.
CREATE OR REPLACE FUNCTION fn_set_conference_item_received_qty(
    p_pallet_conference_id UUID,
    p_material_id UUID,
    p_received_qty INTEGER,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_pallet_conf RECORD;
    v_conf RECORD;
    v_item RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem registrar contagem de conferência.';
    END IF;

    -- 2. Quantity validation (non-negative integer)
    IF p_received_qty IS NULL OR p_received_qty < 0 THEN
        RAISE EXCEPTION 'Quantidade recebida deve ser um número inteiro maior ou igual a zero.';
    END IF;

    -- 3. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'SET_RECEIVED_QTY',
        'pallet_conference_item',
        p_pallet_conference_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'SET_RECEIVED_QTY' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Lock Pallet Conference & Check EM_ANDAMENTO
    SELECT * INTO v_pallet_conf FROM public.pallet_conferences WHERE id = p_pallet_conference_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência de pallet não encontrada.';
    END IF;

    IF v_pallet_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'O pallet deve estar no status EM_ANDAMENTO para registrar quantidades (status atual: %). Inicie a conferência do pallet antes.', v_pallet_conf.status;
    END IF;

    -- 5. Validate Load Conference and Destination Access
    SELECT * INTO v_conf FROM public.load_conferences WHERE id = v_pallet_conf.conference_id;
    IF NOT FOUND OR v_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'A conferência da carga não está em andamento.';
    END IF;

    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_conf.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso ao destino desta carga.';
    END IF;

    -- 6. Update or Insert Pallet Conference Item
    UPDATE public.pallet_conference_items
    SET received_qty = p_received_qty,
        is_checked = TRUE,
        updated_at = NOW()
    WHERE pallet_conference_id = p_pallet_conference_id AND material_id = p_material_id
    RETURNING * INTO v_item;

    IF NOT FOUND THEN
        -- If item wasn't in expected items, add as unexpected item
        INSERT INTO public.pallet_conference_items (
            pallet_conference_id,
            material_id,
            expected_qty,
            received_qty,
            is_checked,
            is_unexpected,
            created_at,
            updated_at
        ) VALUES (
            p_pallet_conference_id,
            p_material_id,
            0,
            p_received_qty,
            TRUE,
            TRUE,
            NOW(),
            NOW()
        ) RETURNING * INTO v_item;
    END IF;

    -- 7. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'pallet_conference_id', p_pallet_conference_id,
        'material_id', p_material_id,
        'expected_qty', v_item.expected_qty,
        'received_qty', v_item.received_qty,
        'is_checked', TRUE
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- E. RPC: ADD UNEXPECTED CONFERENCE ITEM (fn_add_unexpected_conference_item)
-- Registers unexpected material on the pallet with expected_qty = 0
CREATE OR REPLACE FUNCTION fn_add_unexpected_conference_item(
    p_pallet_conference_id UUID,
    p_material_id UUID,
    p_received_qty INTEGER,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
    RETURN fn_set_conference_item_received_qty(
        p_pallet_conference_id,
        p_material_id,
        p_received_qty,
        p_idempotency_key
    );
END;
$$;

-- F. RPC: ADD UNEXPECTED PALLET CONFERENCE (fn_add_unexpected_pallet_conference)
-- Registers an unexpected physical pallet found on the truck
CREATE OR REPLACE FUNCTION fn_add_unexpected_pallet_conference(
    p_load_id UUID,
    p_code TEXT,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_conf RECORD;
    v_pallet_conf_id UUID;
    v_clean_code TEXT;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem registrar pallets extras.';
    END IF;

    IF p_code IS NULL OR BTRIM(p_code) = '' THEN
        RAISE EXCEPTION 'Identificação/código do pallet inesperado é obrigatório.';
    END IF;
    v_clean_code := UPPER(BTRIM(p_code));

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'ADD_UNEXPECTED_PALLET',
        'load',
        p_load_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'ADD_UNEXPECTED_PALLET' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock Load Conference
    SELECT * INTO v_conf FROM public.load_conferences WHERE load_id = p_load_id FOR UPDATE;
    IF NOT FOUND OR v_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'Conferência da carga não encontrada ou não está em andamento.';
    END IF;

    -- 4. Validate Destination Access
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_conf.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso ao destino desta carga.';
    END IF;

    -- 5. Insert unexpected pallet conference
    INSERT INTO public.pallet_conferences (
        conference_id,
        pallet_id,
        is_unexpected,
        unexpected_code,
        status,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_conf.id,
        NULL,
        TRUE,
        v_clean_code,
        'PENDENTE',
        NULLIF(BTRIM(p_notes), ''),
        NOW(),
        NOW()
    ) RETURNING id INTO v_pallet_conf_id;

    -- 6. Insert occurrence divergence
    INSERT INTO public.divergences (
        load_id,
        conference_id,
        pallet_conference_id,
        type,
        status,
        notes,
        created_by,
        created_at
    ) VALUES (
        p_load_id,
        v_conf.id,
        v_pallet_conf_id,
        'PALLET_DIFERENTE',
        'PENDENTE',
        'Pallet físico inesperado identificado na carga: ' || v_clean_code || COALESCE(' - ' || p_notes, ''),
        v_user_id,
        NOW()
    );

    -- 7. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'pallet_conference_id', v_pallet_conf_id,
        'unexpected_code', v_clean_code,
        'status', 'PENDENTE'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- G. RPC: RECORD PALLET DIVERGENCE / OCCURRENCE (fn_record_pallet_divergence)
CREATE OR REPLACE FUNCTION fn_record_pallet_divergence(
    p_pallet_conference_id UUID,
    p_divergence_type TEXT,
    p_material_id UUID,
    p_expected_qty NUMERIC,
    p_received_qty NUMERIC,
    p_notes TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_pallet_conf RECORD;
    v_conf RECORD;
    v_div_id UUID;
    v_diff NUMERIC;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem registrar divergências.';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'RECORD_DIVERGENCE',
        'pallet_conference',
        p_pallet_conference_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'RECORD_DIVERGENCE' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock Pallet Conference
    SELECT * INTO v_pallet_conf FROM public.pallet_conferences WHERE id = p_pallet_conference_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência de pallet não encontrada.';
    END IF;

    SELECT * INTO v_conf FROM public.load_conferences WHERE id = v_pallet_conf.conference_id;
    IF NOT FOUND OR v_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'Conferência da carga não está em andamento.';
    END IF;

    -- 4. Validate Access
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_conf.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada para o destino desta carga.';
    END IF;

    IF p_expected_qty IS NOT NULL AND p_received_qty IS NOT NULL THEN
        v_diff := ABS(p_received_qty - p_expected_qty);
    ELSE
        v_diff := NULL;
    END IF;

    -- 5. Insert divergence
    INSERT INTO public.divergences (
        load_id,
        conference_id,
        pallet_conference_id,
        pallet_id,
        material_id,
        type,
        expected_qty,
        received_qty,
        difference_qty,
        status,
        notes,
        created_by,
        created_at
    ) VALUES (
        v_conf.load_id,
        v_conf.id,
        p_pallet_conference_id,
        v_pallet_conf.pallet_id,
        p_material_id,
        p_divergence_type,
        p_expected_qty,
        p_received_qty,
        v_diff,
        'PENDENTE',
        NULLIF(BTRIM(p_notes), ''),
        v_user_id,
        NOW()
    ) RETURNING id INTO v_div_id;

    -- 6. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'divergence_id', v_div_id,
        'pallet_conference_id', p_pallet_conference_id,
        'type', p_divergence_type
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- H. RPC: FINALIZE PALLET CONFERENCE (fn_finalize_pallet_conference) — CORE PHYSICAL INFLOW
-- Validates: all items checked (no NULL received_qty)
-- Atomic Concurrency: SELECT FOR UPDATE on stock_in_transit_balances and stock_balances
-- Physical movement & ledger entries:
--   - If dest is OBRA or GALPAO -> DISPONIVEL
--   - If dest is FORNECEDOR -> AGUARDANDO_CLASSIFICACAO
-- Debits strictly received qty from transit (capped at transit balance)
-- Surplus entered via RECONCILIACAO_EXCEDENTE
-- Unexpected material entered via RECONCILIACAO_MATERIAL_DIFERENTE
-- Missing quantity stays pending in transit (no write-off)
-- Pallet transitions to CONFERIDO
CREATE OR REPLACE FUNCTION fn_finalize_pallet_conference(
    p_pallet_conference_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_pallet_conf RECORD;
    v_conf RECORD;
    v_load RECORD;
    v_dest_loc RECORD;
    v_target_bucket stock_bucket;
    v_unconferred_count INTEGER := 0;
    v_item_rec RECORD;
    v_transit_balance RECORD;
    v_transit_qty NUMERIC(12, 2) := 0;
    v_from_transit NUMERIC(12, 2) := 0;
    v_surplus NUMERIC(12, 2) := 0;
    v_missing NUMERIC(12, 2) := 0;
    v_movement_key TEXT;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem finalizar conferências.';
    END IF;

    -- 2. Mandatory Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'FINALIZE_PALLET_CONFERENCE',
        'pallet_conference',
        p_pallet_conference_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'FINALIZE_PALLET_CONFERENCE' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock Pallet Conference FOR UPDATE
    SELECT * INTO v_pallet_conf FROM public.pallet_conferences WHERE id = p_pallet_conference_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência de pallet não encontrada: %', p_pallet_conference_id;
    END IF;

    IF v_pallet_conf.status = 'CONCLUIDA' THEN
        RAISE EXCEPTION 'Este pallet já foi concluído anteriormente.';
    END IF;

    -- 4. Lock and validate Load Conference & Load
    SELECT * INTO v_conf FROM public.load_conferences WHERE id = v_pallet_conf.conference_id FOR UPDATE;
    IF NOT FOUND OR v_conf.status <> 'EM_ANDAMENTO' THEN
        RAISE EXCEPTION 'A conferência da carga não está em andamento.';
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = v_conf.load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    -- 5. Destination authorization
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem permissão no destino da carga.';
    END IF;

    -- 6. Check for unconferred items: ALL expected items MUST be checked (received_qty IS NOT NULL)
    SELECT COUNT(*) INTO v_unconferred_count
    FROM public.pallet_conference_items
    WHERE pallet_conference_id = p_pallet_conference_id
      AND (is_checked = FALSE OR received_qty IS NULL);

    IF v_unconferred_count > 0 THEN
        RAISE EXCEPTION 'Não é permitido finalizar o pallet: existem % item(ns) ainda não conferidos.', v_unconferred_count;
    END IF;

    -- 7. Determine Destination Target Bucket
    SELECT * INTO v_dest_loc FROM public.locations WHERE id = v_load.destination_location_id;
    IF v_dest_loc.type = 'FORNECEDOR' THEN
        v_target_bucket := 'AGUARDANDO_CLASSIFICACAO';
    ELSE
        v_target_bucket := 'DISPONIVEL';
    END IF;

    -- 8. Iterate through each checked item on this pallet conference
    FOR v_item_rec IN
        SELECT * FROM public.pallet_conference_items
        WHERE pallet_conference_id = p_pallet_conference_id
        ORDER BY material_id
    LOOP
        -- If pallet is a regular linked pallet:
        IF v_pallet_conf.pallet_id IS NOT NULL THEN
            -- Lock in-transit balance FOR UPDATE by load, pallet, material, origin and destination
            SELECT * INTO v_transit_balance
            FROM public.stock_in_transit_balances
            WHERE load_id = v_load.id
              AND pallet_id = v_pallet_conf.pallet_id
              AND material_id = v_item_rec.material_id
              AND origin_location_id = v_load.origin_location_id
              AND destination_location_id = v_load.destination_location_id
            FOR UPDATE;

            v_transit_qty := COALESCE(v_transit_balance.quantity, 0);
        ELSE
            v_transit_qty := 0;
        END IF;

        -- CASE A: Material was received (> 0)
        IF v_item_rec.received_qty > 0 THEN
            v_from_transit := LEAST(v_transit_qty, v_item_rec.received_qty);
            v_surplus := GREATEST(0, v_item_rec.received_qty - v_transit_qty);

            -- A1. Physical movement from transit to destination
            IF v_from_transit > 0 THEN
                -- Debit transit balance
                UPDATE public.stock_in_transit_balances
                SET quantity = quantity - v_from_transit,
                    updated_at = NOW()
                WHERE id = v_transit_balance.id;

                -- Credit destination stock balance
                INSERT INTO public.stock_balances (
                    location_id,
                    material_id,
                    bucket,
                    quantity,
                    updated_at
                ) VALUES (
                    v_load.destination_location_id,
                    v_item_rec.material_id,
                    v_target_bucket,
                    v_from_transit,
                    NOW()
                )
                ON CONFLICT (location_id, material_id, bucket)
                DO UPDATE SET
                    quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                    updated_at = NOW();

                -- Record Ledger Movement: RECEBIMENTO_CARGA (EM_TRANSITO -> target_bucket)
                v_movement_key := p_idempotency_key || '-TR-' || v_item_rec.material_id;
                INSERT INTO public.stock_movements (
                    movement_type,
                    material_id,
                    quantity,
                    origin_location_id,
                    destination_location_id,
                    source_bucket,
                    destination_bucket,
                    load_id,
                    pallet_id,
                    demobilization_pallet_id,
                    notes,
                    idempotency_key,
                    created_by,
                    created_at
                ) VALUES (
                    'RECEBIMENTO_CARGA',
                    v_item_rec.material_id,
                    v_from_transit,
                    v_load.origin_location_id,
                    v_load.destination_location_id,
                    'EM_TRANSITO',
                    v_target_bucket,
                    v_load.id,
                    v_pallet_conf.pallet_id,
                    v_pallet_conf.pallet_id,
                    'Recebimento físico de carga ' || v_load.code || ' no destino ' || v_dest_loc.code,
                    v_movement_key,
                    v_user_id,
                    NOW()
                );
            END IF;

            -- A2. Physical movement for surplus or unexpected items
            IF v_surplus > 0 THEN
                -- Credit destination stock balance with surplus
                INSERT INTO public.stock_balances (
                    location_id,
                    material_id,
                    bucket,
                    quantity,
                    updated_at
                ) VALUES (
                    v_load.destination_location_id,
                    v_item_rec.material_id,
                    v_target_bucket,
                    v_surplus,
                    NOW()
                )
                ON CONFLICT (location_id, material_id, bucket)
                DO UPDATE SET
                    quantity = public.stock_balances.quantity + EXCLUDED.quantity,
                    updated_at = NOW();

                IF v_item_rec.expected_qty > 0 THEN
                    -- Surplus of expected material: RECONCILIACAO_EXCEDENTE
                    v_movement_key := p_idempotency_key || '-SUR-' || v_item_rec.material_id;
                    INSERT INTO public.stock_movements (
                        movement_type,
                        material_id,
                        quantity,
                        origin_location_id,
                        destination_location_id,
                        destination_bucket,
                        load_id,
                        pallet_id,
                        demobilization_pallet_id,
                        notes,
                        idempotency_key,
                        created_by,
                        created_at
                    ) VALUES (
                        'RECONCILIACAO_EXCEDENTE',
                        v_item_rec.material_id,
                        v_surplus,
                        v_load.origin_location_id,
                        v_load.destination_location_id,
                        v_target_bucket,
                        v_load.id,
                        v_pallet_conf.pallet_id,
                        v_pallet_conf.pallet_id,
                        'Entrada de excedente de origem na conferência da carga ' || v_load.code,
                        v_movement_key,
                        v_user_id,
                        NOW()
                    );

                    -- Record Divergence: EXCEDENTE_DE_ORIGEM
                    INSERT INTO public.divergences (
                        load_id,
                        conference_id,
                        pallet_conference_id,
                        pallet_id,
                        material_id,
                        type,
                        expected_qty,
                        received_qty,
                        difference_qty,
                        status,
                        notes,
                        created_by,
                        created_at
                    ) VALUES (
                        v_load.id,
                        v_conf.id,
                        p_pallet_conference_id,
                        v_pallet_conf.pallet_id,
                        v_item_rec.material_id,
                        'EXCEDENTE_DE_ORIGEM',
                        v_item_rec.expected_qty,
                        v_item_rec.received_qty,
                        v_surplus,
                        'PENDENTE',
                        'Excedente físico de ' || v_surplus || ' un recebido além do previsto.',
                        v_user_id,
                        NOW()
                    );
                ELSE
                    -- Unexpected material: RECONCILIACAO_MATERIAL_DIFERENTE
                    v_movement_key := p_idempotency_key || '-UNEXP-' || v_item_rec.material_id;
                    INSERT INTO public.stock_movements (
                        movement_type,
                        material_id,
                        quantity,
                        origin_location_id,
                        destination_location_id,
                        destination_bucket,
                        load_id,
                        pallet_id,
                        demobilization_pallet_id,
                        notes,
                        idempotency_key,
                        created_by,
                        created_at
                    ) VALUES (
                        'RECONCILIACAO_MATERIAL_DIFERENTE',
                        v_item_rec.material_id,
                        v_surplus,
                        v_load.origin_location_id,
                        v_load.destination_location_id,
                        v_target_bucket,
                        v_load.id,
                        v_pallet_conf.pallet_id,
                        v_pallet_conf.pallet_id,
                        'Entrada de material não previsto identificado na conferência da carga ' || v_load.code,
                        v_movement_key,
                        v_user_id,
                        NOW()
                    );

                    -- Record Divergence: MATERIAL_DIFERENTE
                    INSERT INTO public.divergences (
                        load_id,
                        conference_id,
                        pallet_conference_id,
                        pallet_id,
                        material_id,
                        type,
                        expected_qty,
                        received_qty,
                        difference_qty,
                        status,
                        notes,
                        created_by,
                        created_at
                    ) VALUES (
                        v_load.id,
                        v_conf.id,
                        p_pallet_conference_id,
                        v_pallet_conf.pallet_id,
                        v_item_rec.material_id,
                        'MATERIAL_DIFERENTE',
                        0,
                        v_item_rec.received_qty,
                        v_item_rec.received_qty,
                        'PENDENTE',
                        'Material físico não previsto identificado no pallet.',
                        v_user_id,
                        NOW()
                    );
                END IF;
            END IF;
        END IF;

        -- CASE B: Missing quantity (FALTANTE)
        IF v_item_rec.received_qty < v_item_rec.expected_qty THEN
            v_missing := v_item_rec.expected_qty - v_item_rec.received_qty;

            -- Note: Missing stock remains in stock_in_transit_balances as pending (NO loss write-off yet!)
            INSERT INTO public.divergences (
                load_id,
                conference_id,
                pallet_conference_id,
                pallet_id,
                material_id,
                type,
                expected_qty,
                received_qty,
                difference_qty,
                status,
                notes,
                created_by,
                created_at
            ) VALUES (
                v_load.id,
                v_conf.id,
                p_pallet_conference_id,
                v_pallet_conf.pallet_id,
                v_item_rec.material_id,
                'FALTANTE',
                v_item_rec.expected_qty,
                v_item_rec.received_qty,
                v_missing,
                'PENDENTE',
                'Falta física de ' || v_missing || ' un na conferência do pallet.',
                v_user_id,
                NOW()
            );
        END IF;

    END LOOP;

    -- 9. Update Pallet Status: RECEBIDO -> CONFERIDO (if normal pallet)
    IF v_pallet_conf.pallet_id IS NOT NULL THEN
        UPDATE public.demobilization_pallets
        SET status = 'CONFERIDO',
            updated_at = NOW()
        WHERE id = v_pallet_conf.pallet_id;
    END IF;

    -- 10. Update Pallet Conference Status: CONCLUIDA
    UPDATE public.pallet_conferences
    SET status = 'CONCLUIDA',
        finished_at = NOW(),
        finished_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_pallet_conference_id;

    -- 11. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'PALLET_CONFERENCE_FINALIZED',
        'pallet_conferences',
        p_pallet_conference_id,
        jsonb_build_object(
            'pallet_conference_id', p_pallet_conference_id,
            'pallet_id', v_pallet_conf.pallet_id,
            'load_id', v_load.id,
            'status', 'CONCLUIDA',
            'finished_at', NOW()
        ),
        NOW()
    );

    -- 12. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'pallet_conference_id', p_pallet_conference_id,
        'status', 'CONCLUIDA',
        'finished_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- I. RPC: FINALIZE LOAD CONFERENCE (fn_finalize_load_conference)
-- Validates: all pallet conferences for this load are 'CONCLUIDA'
-- Transitions load_conference to 'CONCLUIDA', load to 'CONFERIDA'
CREATE OR REPLACE FUNCTION fn_finalize_load_conference(
    p_load_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_conf RECORD;
    v_pending_pallets_count INTEGER := 0;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem finalizar conferências.';
    END IF;

    -- 2. Mandatory Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'FINALIZE_LOAD_CONFERENCE',
        'load',
        p_load_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'FINALIZE_LOAD_CONFERENCE' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock and validate Load
    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status <> 'EM_CONFERENCIA' THEN
        RAISE EXCEPTION 'Apenas cargas em conferência podem ser finalizadas (status atual: %).', v_load.status;
    END IF;

    -- 4. Lock and validate Load Conference
    SELECT * INTO v_conf FROM public.load_conferences WHERE load_id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência da carga não encontrada.';
    END IF;

    -- 5. Validate destination authorization
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada para o destino desta carga.';
    END IF;

    -- 6. Validate that ALL pallets in this conference are CONCLUIDA
    SELECT COUNT(*) INTO v_pending_pallets_count
    FROM public.pallet_conferences
    WHERE conference_id = v_conf.id
      AND status <> 'CONCLUIDA';

    IF v_pending_pallets_count > 0 THEN
        RAISE EXCEPTION 'Não é permitido finalizar a conferência: ainda existem % pallet(s) com conferência pendente ou em andamento.', v_pending_pallets_count;
    END IF;

    -- 7. Update Load Conference: status = CONCLUIDA
    UPDATE public.load_conferences
    SET status = 'CONCLUIDA',
        finished_at = NOW(),
        finished_by = v_user_id,
        updated_at = NOW()
    WHERE id = v_conf.id;

    -- 8. Update Load status: EM_CONFERENCIA -> CONFERIDA
    UPDATE public.loads
    SET status = 'CONFERIDA',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 9. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'LOAD_CONFERENCE_FINALIZED',
        'load_conferences',
        v_conf.id,
        jsonb_build_object(
            'load_id', p_load_id,
            'code', v_load.code,
            'status', 'CONFERIDA',
            'finished_at', NOW()
        ),
        NOW()
    );

    -- 10. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'code', v_load.code,
        'status', 'CONFERIDA',
        'finished_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- J. RPC: ADMINISTRATIVE FINALIZE LOAD (fn_finalize_load)
-- Transitions load from 'CONFERIDA' to 'FINALIZADA'
CREATE OR REPLACE FUNCTION fn_finalize_load(
    p_load_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_has_dest_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem finalizar cargas administrativamente.';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key,
        operation_type,
        entity_type,
        entity_id,
        user_id,
        status,
        response_payload,
        created_at
    ) VALUES (
        p_idempotency_key,
        'FINALIZE_LOAD',
        'load',
        p_load_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_idempotency.operation_type <> 'FINALIZE_LOAD' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock and validate Load
    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status <> 'CONFERIDA' THEN
        RAISE EXCEPTION 'Apenas cargas com status CONFERIDA podem ser arquivadas como FINALIZADA (status atual: %).', v_load.status;
    END IF;

    -- 4. Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_dest_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.destination_location_id
        ) INTO v_has_dest_access;
    END IF;

    IF NOT v_has_dest_access THEN
        RAISE EXCEPTION 'Permissão negada para finalizar esta carga.';
    END IF;

    -- 5. Transition to FINALIZADA
    UPDATE public.loads
    SET status = 'FINALIZADA',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- Pallets transition to FINALIZADO
    UPDATE public.demobilization_pallets
    SET status = 'FINALIZADO',
        updated_at = NOW()
    WHERE id IN (
        SELECT pallet_id FROM public.load_pallets WHERE load_id = p_load_id AND is_active = TRUE
    );

    -- 6. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'LOAD_ADMIN_FINALIZED',
        'loads',
        p_load_id,
        jsonb_build_object('load_id', p_load_id, 'code', v_load.code, 'status', 'FINALIZADA'),
        NOW()
    );

    -- 7. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'code', v_load.code,
        'status', 'FINALIZADA'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;
