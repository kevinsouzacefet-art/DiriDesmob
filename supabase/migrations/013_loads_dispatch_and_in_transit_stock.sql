-- ============================================================================
-- 013_LOADS_DISPATCH_AND_IN_TRANSIT_STOCK.SQL
-- DiriDesmob Phase 2.4 - Loads, Dispatch, and In-Transit Stock Segregation
-- Fully Audited, Hardened & Transact Safe Implementation
-- ============================================================================

-- 1. ENUMS & ENUM EXTENSIONS
DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'PRONTA_PARA_ENVIO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'ENVIADA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'EM_TRANSITO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'RECEBIDA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'EM_CONFERENCIA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'CONFERIDA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'FINALIZADA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'CANCELADA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend pallet_status enum
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'EM_MONTAGEM';
EXCEPTION WHEN duplicate_object THEN null; END $$;
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
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'RECEBIDO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'CONFERIDO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'FINALIZADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'DESMONTADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE pallet_status ADD VALUE IF NOT EXISTS 'CANCELADO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend stock_bucket enum
DO $$ BEGIN
    ALTER TYPE stock_bucket ADD VALUE IF NOT EXISTS 'EM_TRANSITO';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend stock_movement_type enum
DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'EXPEDICAO_CARGA';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'CANCELAMENTO_EXPEDICAO';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'RECEBIMENTO_CARGA';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. SEQUENCE AND LOAD CODE GENERATOR (CAR-000001)
CREATE SEQUENCE IF NOT EXISTS load_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_load_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'CAR-' || LPAD(nextval('load_code_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. LOADS TABLE DEFINITION & REFINEMENT
CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE DEFAULT generate_load_code(),
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    status load_status NOT NULL DEFAULT 'RASCUNHO',
    vehicle_plate TEXT,
    driver_name TEXT,
    carrier_name TEXT,
    departure_date DATE,
    expected_arrival_date DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.profiles(id),
    cancellation_reason TEXT,
    CONSTRAINT chk_loads_different_locations CHECK (origin_location_id <> destination_location_id)
);

-- Ensure all necessary columns exist on loads table if previously created
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS carrier_name TEXT,
ADD COLUMN IF NOT EXISTS departure_date DATE,
ADD COLUMN IF NOT EXISTS expected_arrival_date DATE,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_loads_origin ON public.loads(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_loads_dest ON public.loads(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_loads_status ON public.loads(status);
CREATE INDEX IF NOT EXISTS idx_loads_code ON public.loads(code);
CREATE INDEX IF NOT EXISTS idx_loads_created_at ON public.loads(created_at DESC);

DROP TRIGGER IF EXISTS trg_loads_updated_at ON public.loads;
CREATE TRIGGER trg_loads_updated_at
BEFORE UPDATE ON public.loads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. LOAD PALLETS TABLE (ASSOCIATION WITH LIFECYCLE HISTORY)
CREATE TABLE IF NOT EXISTS public.load_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.load_pallets
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Enforce that a pallet can belong to at most ONE ACTIVE load at any given moment
CREATE UNIQUE INDEX IF NOT EXISTS uq_load_pallets_active_pallet 
ON public.load_pallets (pallet_id) 
WHERE (is_active = TRUE);

CREATE INDEX IF NOT EXISTS idx_load_pallets_load ON public.load_pallets(load_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_load_pallets_pallet ON public.load_pallets(pallet_id);

-- 5. STOCK IN TRANSIT BALANCES (STRICTLY SEGREGATED)
CREATE TABLE IF NOT EXISTS public.stock_in_transit_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE RESTRICT,
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0 AND quantity = trunc(quantity)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transit_load_pallet_mat UNIQUE (load_id, pallet_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transit_load ON public.stock_in_transit_balances(load_id);
CREATE INDEX IF NOT EXISTS idx_stock_transit_pallet ON public.stock_in_transit_balances(pallet_id);
CREATE INDEX IF NOT EXISTS idx_stock_transit_material ON public.stock_in_transit_balances(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transit_origin ON public.stock_in_transit_balances(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transit_dest ON public.stock_in_transit_balances(destination_location_id);

DROP TRIGGER IF EXISTS trg_transit_balances_updated_at ON public.stock_in_transit_balances;
CREATE TRIGGER trg_transit_balances_updated_at
BEFORE UPDATE ON public.stock_in_transit_balances
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. EXTEND STOCK MOVEMENTS FOR LOAD & PALLET TRACKING
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pallet_id UUID REFERENCES public.demobilization_pallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_load ON public.stock_movements(load_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_pallet ON public.stock_movements(pallet_id);

-- 7. RLS POLICIES FOR LOADS, LOAD_PALLETS AND IN-TRANSIT STOCK
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_transit_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_loads_sel" ON public.loads;
CREATE POLICY "p_loads_sel" ON public.loads
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR (
        EXISTS (
            SELECT 1 FROM public.user_location_access ula
            WHERE ula.user_id = auth.uid()
              AND (ula.location_id = loads.origin_location_id OR ula.location_id = loads.destination_location_id)
        )
    )
);

DROP POLICY IF EXISTS "p_loads_block_write" ON public.loads;
CREATE POLICY "p_loads_block_write" ON public.loads
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "p_load_pallets_sel" ON public.load_pallets;
CREATE POLICY "p_load_pallets_sel" ON public.load_pallets
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.loads l
        JOIN public.user_location_access ula ON (ula.location_id = l.origin_location_id OR ula.location_id = l.destination_location_id)
        WHERE l.id = load_pallets.load_id
          AND ula.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "p_load_pallets_block_write" ON public.load_pallets;
CREATE POLICY "p_load_pallets_block_write" ON public.load_pallets
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "p_transit_balances_sel" ON public.stock_in_transit_balances;
CREATE POLICY "p_transit_balances_sel" ON public.stock_in_transit_balances
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA')
    OR EXISTS (
        SELECT 1 FROM public.user_location_access ula
        WHERE ula.user_id = auth.uid()
          AND (ula.location_id = stock_in_transit_balances.origin_location_id OR ula.location_id = stock_in_transit_balances.destination_location_id)
    )
);

DROP POLICY IF EXISTS "p_transit_balances_block_write" ON public.stock_in_transit_balances;
CREATE POLICY "p_transit_balances_block_write" ON public.stock_in_transit_balances
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- ============================================================================
-- 8. TRANSACTIONAL SECURITY DEFINER RPCS FOR LOADS & DISPATCH
-- ============================================================================

-- A. RPC: CREATE LOAD (fn_create_load)
CREATE OR REPLACE FUNCTION fn_create_load(
    p_origin_location_id UUID,
    p_destination_location_id UUID,
    p_vehicle_plate TEXT,
    p_driver_name TEXT,
    p_carrier_name TEXT,
    p_departure_date DATE,
    p_expected_arrival_date DATE,
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
    v_has_access BOOLEAN := FALSE;
    v_orig_loc RECORD;
    v_dest_loc RECORD;
    v_existing_idempotency RECORD;
    v_load_id UUID;
    v_load_code TEXT;
    v_clean_plate TEXT;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- ANALISTA is strictly read-only
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de leitura e não podem criar cargas.';
    END IF;

    -- Check origin location authorization
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = p_origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não possui acesso operacional à localização de origem.';
    END IF;

    -- 2. Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Idempotency Check & Reservation
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
        'CREATE_LOAD',
        'load',
        NULL,
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
        IF v_existing_idempotency.operation_type <> 'CREATE_LOAD' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Location Validations
    IF p_origin_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'A localização de origem e destino devem ser diferentes.';
    END IF;

    SELECT * INTO v_orig_loc FROM public.locations WHERE id = p_origin_location_id;
    IF NOT FOUND OR NOT v_orig_loc.is_active THEN
        RAISE EXCEPTION 'Localização de origem inválida ou inativa.';
    END IF;

    SELECT * INTO v_dest_loc FROM public.locations WHERE id = p_destination_location_id;
    IF NOT FOUND OR NOT v_dest_loc.is_active THEN
        RAISE EXCEPTION 'Localização de destino inválida ou inativa.';
    END IF;

    -- Plate normalization (remove non-alphanumeric, uppercase)
    IF p_vehicle_plate IS NOT NULL AND BTRIM(p_vehicle_plate) <> '' THEN
        v_clean_plate := UPPER(REGEXP_REPLACE(p_vehicle_plate, '[^a-zA-Z0-9]', '', 'g'));
    ELSE
        v_clean_plate := NULL;
    END IF;

    -- 5. Insert Load
    v_load_code := generate_load_code();
    
    INSERT INTO public.loads (
        code,
        origin_location_id,
        destination_location_id,
        status,
        vehicle_plate,
        driver_name,
        carrier_name,
        departure_date,
        expected_arrival_date,
        notes,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_load_code,
        p_origin_location_id,
        p_destination_location_id,
        'RASCUNHO',
        v_clean_plate,
        NULLIF(BTRIM(p_driver_name), ''),
        NULLIF(BTRIM(p_carrier_name), ''),
        p_departure_date,
        p_expected_arrival_date,
        NULLIF(BTRIM(p_notes), ''),
        v_user_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_load_id;

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
        'LOAD_CREATED',
        'loads',
        v_load_id,
        jsonb_build_object(
            'code', v_load_code,
            'origin_location_id', p_origin_location_id,
            'destination_location_id', p_destination_location_id,
            'status', 'RASCUNHO'
        ),
        NOW()
    );

    -- 7. Response Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', v_load_id,
        'code', v_load_code,
        'status', 'RASCUNHO'
    );

    UPDATE public.operation_idempotency
    SET entity_id = v_load_id,
        status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- B. RPC: UPDATE LOAD DETAILS (fn_update_load_details)
CREATE OR REPLACE FUNCTION fn_update_load_details(
    p_load_id UUID,
    p_vehicle_plate TEXT,
    p_driver_name TEXT,
    p_carrier_name TEXT,
    p_departure_date DATE,
    p_expected_arrival_date DATE,
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
    v_load RECORD;
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_clean_plate TEXT;
    v_result_payload JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem alterar cargas.';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    INSERT INTO public.operation_idempotency (
        operation_key, operation_type, entity_type, entity_id, user_id, status, response_payload, created_at
    ) VALUES (
        p_idempotency_key, 'UPDATE_LOAD_DETAILS', 'load', p_load_id, v_user_id, 'PROCESSING', NULL, NOW()
    ) ON CONFLICT (operation_key) DO NOTHING;

    SELECT * INTO v_existing_idempotency FROM public.operation_idempotency WHERE operation_key = p_idempotency_key FOR UPDATE;
    IF FOUND AND v_existing_idempotency.status = 'EXECUTED' THEN
        RETURN v_existing_idempotency.response_payload;
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status NOT IN ('RASCUNHO', 'PRONTA_PARA_ENVIO') THEN
        RAISE EXCEPTION 'Apenas cargas em RASCUNHO ou PRONTA PARA ENVIO podem ter dados editados.';
    END IF;

    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada para a origem desta carga.';
    END IF;

    IF p_vehicle_plate IS NOT NULL AND BTRIM(p_vehicle_plate) <> '' THEN
        v_clean_plate := UPPER(REGEXP_REPLACE(p_vehicle_plate, '[^a-zA-Z0-9]', '', 'g'));
    ELSE
        v_clean_plate := NULL;
    END IF;

    UPDATE public.loads
    SET vehicle_plate = v_clean_plate,
        driver_name = NULLIF(BTRIM(p_driver_name), ''),
        carrier_name = NULLIF(BTRIM(p_carrier_name), ''),
        departure_date = p_departure_date,
        expected_arrival_date = p_expected_arrival_date,
        notes = NULLIF(BTRIM(p_notes), ''),
        updated_at = NOW()
    WHERE id = p_load_id;

    v_result_payload := jsonb_build_object('success', TRUE, 'load_id', p_load_id);

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- C. RPC: ATTACH PALLET TO LOAD (fn_attach_pallet_to_load)
CREATE OR REPLACE FUNCTION fn_attach_pallet_to_load(
    p_load_id UUID,
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
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_pallet RECORD;
    v_items_count INTEGER;
    v_active_load_count INTEGER;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem associar pallets a cargas.';
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
        'ATTACH_PALLET_TO_LOAD',
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
        IF v_existing_idempotency.operation_type <> 'ATTACH_PALLET_TO_LOAD' THEN
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

    IF v_load.status <> 'RASCUNHO' THEN
        RAISE EXCEPTION 'Apenas cargas com status RASCUNHO podem receber novos pallets (status atual: %).', v_load.status;
    END IF;

    -- Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem permissão na origem da carga.';
    END IF;

    -- 4. Lock and validate Pallet
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado.';
    END IF;

    IF v_pallet.status <> 'PRONTO' THEN
        RAISE EXCEPTION 'Apenas pallets com status PRONTO podem ser adicionados à carga (status atual: %).', v_pallet.status;
    END IF;

    IF v_pallet.origin_location_id <> v_load.origin_location_id THEN
        RAISE EXCEPTION 'O pallet pertence a uma localização de origem diferente da carga (% vs %).', v_pallet.origin_location_id, v_load.origin_location_id;
    END IF;

    -- Check pallet has items
    SELECT COUNT(*) INTO v_items_count 
    FROM public.demobilization_pallet_items 
    WHERE pallet_id = p_pallet_id AND quantity > 0;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION 'O pallet não possui materiais e não pode ser adicionado à carga.';
    END IF;

    -- Check pallet is not in another active load
    SELECT COUNT(*) INTO v_active_load_count
    FROM public.load_pallets
    WHERE pallet_id = p_pallet_id AND is_active = TRUE;

    IF v_active_load_count > 0 THEN
        RAISE EXCEPTION 'O pallet já está associado a outra carga ativa.';
    END IF;

    -- 5. Attach Pallet to Load (Create Active Association)
    INSERT INTO public.load_pallets (
        load_id,
        pallet_id,
        is_active,
        created_at,
        created_by
    ) VALUES (
        p_load_id,
        p_pallet_id,
        TRUE,
        NOW(),
        v_user_id
    );

    -- 6. Transition Pallet Status: PRONTO -> RESERVADO
    -- (Items remain in origin RESERVADO bucket, NO ledger stock movement occurs at this step)
    UPDATE public.demobilization_pallets
    SET status = 'RESERVADO',
        destination_location_id = v_load.destination_location_id,
        updated_at = NOW()
    WHERE id = p_pallet_id;

    -- Update load timestamp
    UPDATE public.loads SET updated_at = NOW() WHERE id = p_load_id;

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
        'PALLET_ATTACHED',
        'load_pallets',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'pallet_id', p_pallet_id,
            'pallet_code', v_pallet.code,
            'load_code', v_load.code
        ),
        NOW()
    );

    -- 8. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'pallet_id', p_pallet_id,
        'pallet_code', v_pallet.code,
        'pallet_status', 'RESERVADO'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- D. RPC: DETACH PALLET FROM LOAD (fn_detach_pallet_from_load)
CREATE OR REPLACE FUNCTION fn_detach_pallet_from_load(
    p_load_id UUID,
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
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_pallet RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem remover pallets de cargas.';
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
        'DETACH_PALLET_FROM_LOAD',
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
        IF v_existing_idempotency.operation_type <> 'DETACH_PALLET_FROM_LOAD' THEN
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

    IF v_load.status NOT IN ('RASCUNHO', 'PRONTA_PARA_ENVIO') THEN
        RAISE EXCEPTION 'Não é permitido remover pallets de cargas já enviadas (status atual: %).', v_load.status;
    END IF;

    -- Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada para a origem desta carga.';
    END IF;

    -- 4. Lock and validate Pallet
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado.';
    END IF;

    -- 5. Deactivate association (keeps history)
    UPDATE public.load_pallets
    SET is_active = FALSE
    WHERE load_id = p_load_id AND pallet_id = p_pallet_id AND is_active = TRUE;

    -- 6. Return Pallet Status: RESERVADO/EM_CARGA -> PRONTO
    -- (Stock stays in RESERVADO bucket on origin, never moves to DISPONIVEL on detach)
    UPDATE public.demobilization_pallets
    SET status = 'PRONTO',
        updated_at = NOW()
    WHERE id = p_pallet_id;

    -- If load was PRONTA_PARA_ENVIO, return to RASCUNHO if needed
    UPDATE public.loads SET updated_at = NOW() WHERE id = p_load_id;

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
        'PALLET_DETACHED',
        'load_pallets',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'pallet_id', p_pallet_id,
            'pallet_code', v_pallet.code,
            'load_code', v_load.code
        ),
        NOW()
    );

    -- 8. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'pallet_id', p_pallet_id,
        'pallet_status', 'PRONTO'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- E. RPC: MARK LOAD READY (fn_mark_load_ready)
CREATE OR REPLACE FUNCTION fn_mark_load_ready(
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
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_active_pallets_count INTEGER;
    v_invalid_pallets_count INTEGER;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas não podem alterar status da carga.';
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
        'MARK_LOAD_READY',
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
        IF v_existing_idempotency.operation_type <> 'MARK_LOAD_READY' THEN
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

    IF v_load.status <> 'RASCUNHO' THEN
        RAISE EXCEPTION 'Apenas cargas em RASCUNHO podem ser marcadas como prontas para envio (status atual: %).', v_load.status;
    END IF;

    -- Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada para a origem desta carga.';
    END IF;

    -- 4. Mandatory fields validation before ready
    IF v_load.vehicle_plate IS NULL OR BTRIM(v_load.vehicle_plate) = '' THEN
        RAISE EXCEPTION 'Placa do veículo é obrigatória antes de marcar a carga como pronta.';
    END IF;

    IF v_load.driver_name IS NULL OR BTRIM(v_load.driver_name) = '' THEN
        RAISE EXCEPTION 'Nome do motorista é obrigatório antes de marcar a carga como pronta.';
    END IF;

    IF v_load.departure_date IS NULL THEN
        RAISE EXCEPTION 'Data de saída é obrigatória antes de marcar a carga como pronta.';
    END IF;

    IF v_load.expected_arrival_date IS NULL THEN
        RAISE EXCEPTION 'Previsão de chegada é obrigatória antes de marcar a carga como pronta.';
    END IF;

    -- 5. Pallets validation
    SELECT COUNT(*) INTO v_active_pallets_count
    FROM public.load_pallets
    WHERE load_id = p_load_id AND is_active = TRUE;

    IF v_active_pallets_count = 0 THEN
        RAISE EXCEPTION 'A carga deve possuir ao menos 1 pallet associado para ficar pronta para envio.';
    END IF;

    -- Validate that all attached pallets have origin equal to load origin and have items
    SELECT COUNT(*) INTO v_invalid_pallets_count
    FROM public.load_pallets lp
    JOIN public.demobilization_pallets p ON p.id = lp.pallet_id
    WHERE lp.load_id = p_load_id AND lp.is_active = TRUE
      AND (p.origin_location_id <> v_load.origin_location_id 
           OR NOT EXISTS (SELECT 1 FROM public.demobilization_pallet_items pi WHERE pi.pallet_id = p.id AND pi.quantity > 0));

    IF v_invalid_pallets_count > 0 THEN
        RAISE EXCEPTION 'Existem pallets associados inválidos (origem divergente ou sem itens).';
    END IF;

    -- 6. Transition Load: RASCUNHO -> PRONTA_PARA_ENVIO
    UPDATE public.loads
    SET status = 'PRONTA_PARA_ENVIO',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 7. Transition Pallets: RESERVADO -> EM_CARGA
    -- (Stock stays RESERVADO in origin location)
    UPDATE public.demobilization_pallets
    SET status = 'EM_CARGA',
        updated_at = NOW()
    WHERE id IN (
        SELECT pallet_id FROM public.load_pallets WHERE load_id = p_load_id AND is_active = TRUE
    );

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
        'LOAD_READY',
        'loads',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'code', v_load.code,
            'pallets_count', v_active_pallets_count,
            'status', 'PRONTA_PARA_ENVIO'
        ),
        NOW()
    );

    -- 9. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'status', 'PRONTA_PARA_ENVIO',
        'pallets_count', v_active_pallets_count
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- F. RPC: REOPEN LOAD (fn_reopen_load)
CREATE OR REPLACE FUNCTION fn_reopen_load(
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
    v_has_access BOOLEAN := FALSE;
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
        RAISE EXCEPTION 'Permissão negada. Analistas não podem reabrir cargas.';
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
        'REOPEN_LOAD',
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
        IF v_existing_idempotency.operation_type <> 'REOPEN_LOAD' THEN
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

    IF v_load.status <> 'PRONTA_PARA_ENVIO' THEN
        RAISE EXCEPTION 'Apenas cargas PRONTA PARA ENVIO podem ser reabertas para RASCUNHO (status atual: %).', v_load.status;
    END IF;

    -- Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada para a origem desta carga.';
    END IF;

    -- 4. Transition Load: PRONTA_PARA_ENVIO -> RASCUNHO
    UPDATE public.loads
    SET status = 'RASCUNHO',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 5. Transition Pallets: EM_CARGA -> RESERVADO
    UPDATE public.demobilization_pallets
    SET status = 'RESERVADO',
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
        'LOAD_REOPENED',
        'loads',
        p_load_id,
        jsonb_build_object('load_id', p_load_id, 'code', v_load.code, 'status', 'RASCUNHO'),
        NOW()
    );

    -- 7. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'status', 'RASCUNHO'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- G. RPC: DISPATCH LOAD (fn_dispatch_load) — THE CORE CRITICAL OPERATION
CREATE OR REPLACE FUNCTION fn_dispatch_load(
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
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_pallet_rec RECORD;
    v_item_rec RECORD;
    v_stock_balance RECORD;
    v_active_pallets_count INTEGER := 0;
    v_total_pieces_dispatched INTEGER := 0;
    v_movement_key TEXT;
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role = 'ANALISTA' THEN
        RAISE EXCEPTION 'Permissão negada. Analistas possuem perfil de leitura e não podem despachar cargas.';
    END IF;

    -- 2. Mandatory Idempotency Key
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. Atomic Idempotency Reservation
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
        'DISPATCH_LOAD',
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
        IF v_existing_idempotency.operation_type <> 'DISPATCH_LOAD' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        IF v_existing_idempotency.entity_type <> 'load' OR v_existing_idempotency.entity_id <> p_load_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outra entidade: % (%)', v_existing_idempotency.entity_type, v_existing_idempotency.entity_id;
        END IF;

        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 4. Lock and validate Load
    SELECT * INTO v_load FROM public.loads WHERE id = p_load_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga não encontrada.';
    END IF;

    IF v_load.status <> 'PRONTA_PARA_ENVIO' THEN
        RAISE EXCEPTION 'Apenas cargas no estado PRONTA PARA ENVIO podem ser despachadas (status atual: %).', v_load.status;
    END IF;

    -- Authorization check (User MUST have access to origin location)
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND location_id = v_load.origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não possui autorização operacional na origem desta carga.';
    END IF;

    -- 5. Iterate through active pallets of this load
    FOR v_pallet_rec IN 
        SELECT p.* 
        FROM public.load_pallets lp
        JOIN public.demobilization_pallets p ON p.id = lp.pallet_id
        WHERE lp.load_id = p_load_id AND lp.is_active = TRUE
        FOR UPDATE OF p
    LOOP
        v_active_pallets_count := v_active_pallets_count + 1;

        IF v_pallet_rec.status <> 'EM_CARGA' THEN
            RAISE EXCEPTION 'Pallet % não está no estado EM_CARGA (status atual: %).', v_pallet_rec.code, v_pallet_rec.status;
        END IF;

        IF v_pallet_rec.origin_location_id <> v_load.origin_location_id THEN
            RAISE EXCEPTION 'Pallet % tem origem divergente da carga.', v_pallet_rec.code;
        END IF;

        -- 6. For each item in the pallet:
        -- Lock and debit origin RESERVADO stock, credit segregated in-transit balance, and record movement
        FOR v_item_rec IN 
            SELECT * FROM public.demobilization_pallet_items 
            WHERE pallet_id = v_pallet_rec.id 
            ORDER BY material_id
        LOOP
            -- Lock RESERVADO stock balance at origin FOR UPDATE
            SELECT * INTO v_stock_balance
            FROM public.stock_balances
            WHERE location_id = v_load.origin_location_id
              AND material_id = v_item_rec.material_id
              AND bucket = 'RESERVADO'
            FOR UPDATE;

            IF NOT FOUND OR v_stock_balance.quantity < v_item_rec.quantity THEN
                RAISE EXCEPTION 'Saldo insuficiente no bucket RESERVADO na origem para o material %. (Saldo: %, Necessário: %)', 
                    v_item_rec.material_id, COALESCE(v_stock_balance.quantity, 0), v_item_rec.quantity;
            END IF;

            -- 6a. Decrement origin RESERVADO balance
            UPDATE public.stock_balances
            SET quantity = quantity - v_item_rec.quantity,
                updated_at = NOW()
            WHERE id = v_stock_balance.id;

            -- 6b. Credit strictly segregated in-transit balance
            INSERT INTO public.stock_in_transit_balances (
                load_id,
                pallet_id,
                material_id,
                origin_location_id,
                destination_location_id,
                quantity,
                created_at,
                updated_at
            ) VALUES (
                p_load_id,
                v_pallet_rec.id,
                v_item_rec.material_id,
                v_load.origin_location_id,
                v_load.destination_location_id,
                v_item_rec.quantity,
                NOW(),
                NOW()
            )
            ON CONFLICT (load_id, pallet_id, material_id)
            DO UPDATE SET 
                quantity = stock_in_transit_balances.quantity + EXCLUDED.quantity,
                updated_at = NOW();

            -- 6c. Record immutable Stock Movement: EXPEDICAO_CARGA (RESERVADO -> EM_TRANSITO)
            v_movement_key := p_idempotency_key || '-' || v_pallet_rec.id || '-' || v_item_rec.material_id;

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
                'EXPEDICAO_CARGA',
                v_item_rec.material_id,
                v_item_rec.quantity,
                v_load.origin_location_id,
                v_load.destination_location_id,
                'RESERVADO',
                'EM_TRANSITO',
                p_load_id,
                v_pallet_rec.id,
                v_pallet_rec.id,
                'Expedição de carga ' || v_load.code || ' com pallet ' || v_pallet_rec.code,
                v_movement_key,
                v_user_id,
                NOW()
            );

            v_total_pieces_dispatched := v_total_pieces_dispatched + v_item_rec.quantity::INTEGER;
        END LOOP;

        -- 7. Update Pallet Status: EM_CARGA -> ENVIADO
        UPDATE public.demobilization_pallets
        SET status = 'ENVIADO',
            updated_at = NOW()
        WHERE id = v_pallet_rec.id;

    END LOOP;

    IF v_active_pallets_count = 0 THEN
        RAISE EXCEPTION 'A carga não possui pallets ativos para expedição.';
    END IF;

    -- 8. Update Load Status: PRONTA_PARA_ENVIO -> ENVIADA
    UPDATE public.loads
    SET status = 'ENVIADA',
        sent_at = NOW(),
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
        'LOAD_DISPATCHED',
        'loads',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'code', v_load.code,
            'pallets_count', v_active_pallets_count,
            'total_pieces', v_total_pieces_dispatched,
            'status', 'ENVIADA',
            'sent_at', NOW()
        ),
        NOW()
    );

    -- 10. Construct Result Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'code', v_load.code,
        'status', 'ENVIADA',
        'pallets_count', v_active_pallets_count,
        'total_pieces_dispatched', v_total_pieces_dispatched,
        'sent_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- H. RPC: MARK LOAD IN TRANSIT (fn_mark_load_in_transit)
CREATE OR REPLACE FUNCTION fn_mark_load_in_transit(
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
    v_has_access BOOLEAN := FALSE;
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
        RAISE EXCEPTION 'Permissão negada. Analistas não podem alterar status da carga.';
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
        'MARK_LOAD_IN_TRANSIT',
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
        IF v_existing_idempotency.operation_type <> 'MARK_LOAD_IN_TRANSIT' THEN
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

    IF v_load.status <> 'ENVIADA' THEN
        RAISE EXCEPTION 'Apenas cargas no estado ENVIADA podem progredir para EM TRÂNSITO (status atual: %).', v_load.status;
    END IF;

    -- Authorization check
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access 
            WHERE user_id = v_user_id AND (location_id = v_load.origin_location_id OR location_id = v_load.destination_location_id)
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada para esta carga.';
    END IF;

    -- 4. Update Load Status: ENVIADA -> EM_TRANSITO
    UPDATE public.loads
    SET status = 'EM_TRANSITO',
        updated_at = NOW()
    WHERE id = p_load_id;

    -- 5. Audit Log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'LOAD_IN_TRANSIT',
        'loads',
        p_load_id,
        jsonb_build_object('load_id', p_load_id, 'code', v_load.code, 'status', 'EM_TRANSITO'),
        NOW()
    );

    -- 6. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'status', 'EM_TRANSITO'
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- I. RPC: CANCEL LOAD (fn_cancel_load) — STRICTLY ADMIN CONTROLLED
CREATE OR REPLACE FUNCTION fn_cancel_load(
    p_load_id UUID,
    p_reason TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_existing_idempotency RECORD;
    v_load RECORD;
    v_transit_rec RECORD;
    v_result_payload JSONB;
BEGIN
    -- 1. Strict Authentication & Role: ONLY ADMINISTRADOR
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role <> 'ADMINISTRADOR' THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Administradores podem cancelar cargas.';
    END IF;

    -- Reason mandatory
    IF p_reason IS NULL OR BTRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Justificativa de cancelamento é obrigatória.';
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
        'CANCEL_LOAD',
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
        IF v_existing_idempotency.operation_type <> 'CANCEL_LOAD' THEN
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

    IF v_load.status IN ('CANCELADA', 'RECEBIDA', 'EM_CONFERENCIA', 'CONFERIDA', 'FINALIZADA') THEN
        RAISE EXCEPTION 'Cargas com status % não podem ser canceladas.', v_load.status;
    END IF;

    -- 4. Case 1: Load not dispatched yet (RASCUNHO or PRONTA_PARA_ENVIO)
    IF v_load.status IN ('RASCUNHO', 'PRONTA_PARA_ENVIO') THEN
        -- Deactivate all load_pallets associations
        UPDATE public.load_pallets
        SET is_active = FALSE
        WHERE load_id = p_load_id AND is_active = TRUE;

        -- Return pallets to PRONTO (Stock remains in origin RESERVADO bucket)
        UPDATE public.demobilization_pallets
        SET status = 'PRONTO',
            updated_at = NOW()
        WHERE id IN (
            SELECT pallet_id FROM public.load_pallets WHERE load_id = p_load_id
        );

    -- 5. Case 2: Load already dispatched (ENVIADA or EM_TRANSITO)
    ELSIF v_load.status IN ('ENVIADA', 'EM_TRANSITO') THEN
        -- Revert in-transit stock back to origin RESERVADO bucket and record compensatory movements
        FOR v_transit_rec IN 
            SELECT * FROM public.stock_in_transit_balances 
            WHERE load_id = p_load_id 
            ORDER BY material_id
            FOR UPDATE
        LOOP
            -- Return quantity to origin RESERVADO bucket
            INSERT INTO public.stock_balances (
                location_id,
                material_id,
                bucket,
                quantity,
                updated_at
            ) VALUES (
                v_transit_rec.origin_location_id,
                v_transit_rec.material_id,
                'RESERVADO',
                v_transit_rec.quantity,
                NOW()
            )
            ON CONFLICT (location_id, material_id, bucket)
            DO UPDATE SET 
                quantity = stock_balances.quantity + EXCLUDED.quantity,
                updated_at = NOW();

            -- Record compensatory movement: CANCELAMENTO_EXPEDICAO (EM_TRANSITO -> RESERVADO)
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
                'CANCELAMENTO_EXPEDICAO',
                v_transit_rec.material_id,
                v_transit_rec.quantity,
                v_transit_rec.origin_location_id,
                v_transit_rec.origin_location_id,
                'EM_TRANSITO',
                'RESERVADO',
                p_load_id,
                v_transit_rec.pallet_id,
                v_transit_rec.pallet_id,
                'Reversão de expedição por cancelamento de carga: ' || p_reason,
                p_idempotency_key || '-rev-' || v_transit_rec.id,
                v_user_id,
                NOW()
            );
        END LOOP;

        -- Clear in-transit balances for this load
        DELETE FROM public.stock_in_transit_balances WHERE load_id = p_load_id;

        -- Deactivate load_pallets associations
        UPDATE public.load_pallets
        SET is_active = FALSE
        WHERE load_id = p_load_id AND is_active = TRUE;

        -- Return pallets to PRONTO so they can be re-associated or managed
        UPDATE public.demobilization_pallets
        SET status = 'PRONTO',
            updated_at = NOW()
        WHERE id IN (
            SELECT pallet_id FROM public.load_pallets WHERE load_id = p_load_id
        );
    END IF;

    -- 6. Update Load status to CANCELADA
    UPDATE public.loads
    SET status = 'CANCELADA',
        cancelled_at = NOW(),
        cancelled_by = v_user_id,
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_load_id;

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
        'LOAD_CANCELLED',
        'loads',
        p_load_id,
        jsonb_build_object(
            'load_id', p_load_id,
            'code', v_load.code,
            'previous_status', v_load.status,
            'reason', p_reason
        ),
        NOW()
    );

    -- 8. Payload & Complete Idempotency
    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'load_id', p_load_id,
        'code', v_load.code,
        'status', 'CANCELADA',
        'cancelled_at', NOW()
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;
