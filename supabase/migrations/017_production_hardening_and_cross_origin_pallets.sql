-- ============================================================================
-- 017_PRODUCTION_HARDENING_AND_CROSS_ORIGIN_PALLETS.SQL
-- Phase 2.8: General Audit, Cross-Origin Palletization (Work/Warehouse/Supplier),
-- Material Dimension Immutability, Append-Only Auditing & Ledger Reconciliation
-- ============================================================================

-- 1. MAKE DEMOBILIZATION_ID OPTIONAL ON PALLETS FOR WAREHOUSE & SUPPLIER MOVEMENTS
ALTER TABLE public.demobilization_pallets
ALTER COLUMN demobilization_id DROP NOT NULL;

-- 2. CREATE OPERATIONAL PALLET RPC (Supports OBRA, GALPAO, FORNECEDOR)
CREATE OR REPLACE FUNCTION fn_create_operational_pallet(
    p_origin_location_id UUID,
    p_destination_location_id UUID DEFAULT NULL,
    p_demobilization_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_origin RECORD;
    v_target RECORD;
    v_demob RECORD;
    v_pallet_id UUID;
    v_code TEXT;
    v_has_access BOOLEAN := FALSE;
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

    -- Validate origin location
    SELECT * INTO v_origin FROM public.locations WHERE id = p_origin_location_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Localização de origem não encontrada ou inativa: %', p_origin_location_id;
    END IF;

    -- Validate destination location if provided
    IF p_destination_location_id IS NOT NULL THEN
        SELECT * INTO v_target FROM public.locations WHERE id = p_destination_location_id AND is_active = TRUE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Localização de destino não encontrada ou inativa: %', p_destination_location_id;
        END IF;
    END IF;

    -- Check access
    IF v_user_role = 'ADMINISTRADOR' THEN
        v_has_access := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = p_origin_location_id
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à origem deste pallet.';
    END IF;

    -- If demobilization_id is provided, validate it
    IF p_demobilization_id IS NOT NULL THEN
        SELECT * INTO v_demob FROM public.demobilizations WHERE id = p_demobilization_id;
        IF NOT FOUND OR v_demob.work_id <> p_origin_location_id THEN
            RAISE EXCEPTION 'Desmobilização inválida para a origem informada.';
        END IF;
    END IF;

    -- Generate unique pallet code (DES-XXXXXX)
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
        p_origin_location_id,
        p_destination_location_id,
        'EM_MONTAGEM',
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_pallet_id;

    -- Audit log
    INSERT INTO public.system_audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_user_id,
        'PALLET_CREATE',
        'demobilization_pallets',
        v_pallet_id,
        jsonb_build_object(
            'code', v_code,
            'origin_location_id', p_origin_location_id,
            'destination_location_id', p_destination_location_id,
            'demobilization_id', p_demobilization_id,
            'status', 'EM_MONTAGEM'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'pallet_id', v_pallet_id,
        'code', v_code,
        'status', 'EM_MONTAGEM'
    );
END;
$$;

-- 3. ENHANCED ADD MATERIAL TO PALLET (RESERVING FROM DISPONIVEL OR REAPROVEITAVEL)
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
    v_has_access BOOLEAN := FALSE;
    v_existing_idempotency RECORD;
    v_pallet RECORD;
    v_origin RECORD;
    v_material RECORD;
    v_available_qty NUMERIC(12, 2);
    v_source_bucket stock_bucket;
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

    -- 2. Validate Quantity
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantidade inválida para inclusão no pallet: %', p_quantity;
    END IF;

    -- 3. Idempotency Key Check
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key é obrigatória.';
    END IF;

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

    -- 4. Lock Pallet & Validate Status
    SELECT * INTO v_pallet FROM public.demobilization_pallets WHERE id = p_pallet_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pallet não encontrado: %', p_pallet_id;
    END IF;

    IF v_pallet.status <> 'EM_MONTAGEM' THEN
        RAISE EXCEPTION 'Inclusão de material permitida apenas em pallets com status EM_MONTAGEM. Status atual: %', v_pallet.status;
    END IF;

    -- 5. Validate Location Access
    SELECT * INTO v_origin FROM public.locations WHERE id = v_pallet.origin_location_id;
    IF v_user_role NOT IN ('ADMINISTRADOR') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_location_access
            WHERE user_id = v_user_id AND location_id = v_pallet.origin_location_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RAISE EXCEPTION 'Permissão negada. Usuário não tem acesso autorizado à origem do pallet.';
        END IF;
    END IF;

    -- 6. Validate Material
    SELECT * INTO v_material FROM public.materials WHERE id = p_material_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Material não encontrado ou inativo: %', p_material_id;
    END IF;

    -- 7. Determine Source Bucket based on location type
    IF v_origin.type = 'FORNECEDOR' THEN
        -- Check if REAPROVEITAVEL is available first
        SELECT quantity INTO v_available_qty 
        FROM public.stock_balances 
        WHERE location_id = v_pallet.origin_location_id 
          AND material_id = p_material_id 
          AND bucket = 'REAPROVEITAVEL' 
        FOR UPDATE;

        IF v_available_qty IS NOT NULL AND v_available_qty >= p_quantity THEN
            v_source_bucket := 'REAPROVEITAVEL';
        ELSE
            -- Fallback to DISPONIVEL or SUCATA if requested
            SELECT quantity INTO v_available_qty 
            FROM public.stock_balances 
            WHERE location_id = v_pallet.origin_location_id 
              AND material_id = p_material_id 
              AND bucket = 'DISPONIVEL' 
            FOR UPDATE;

            IF v_available_qty IS NOT NULL AND v_available_qty >= p_quantity THEN
                v_source_bucket := 'DISPONIVEL';
            ELSE
                RAISE EXCEPTION 'Saldo insuficiente no fornecedor. Solicitado: %, Disponível (Reaproveitável/Disponível): %', 
                    p_quantity, COALESCE(v_available_qty, 0);
            END IF;
        END IF;
    ELSE
        -- Standard locations (OBRA, GALPAO): Reserve from DISPONIVEL
        v_source_bucket := 'DISPONIVEL';
        SELECT quantity INTO v_available_qty 
        FROM public.stock_balances 
        WHERE location_id = v_pallet.origin_location_id 
          AND material_id = p_material_id 
          AND bucket = 'DISPONIVEL' 
        FOR UPDATE;

        IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
            RAISE EXCEPTION 'Saldo insuficiente no bucket DISPONIVEL. Solicitado: %, Disponível: %', p_quantity, COALESCE(v_available_qty, 0);
        END IF;
    END IF;

    -- 8. ATOMIC STOCK BALANCES TRANSITION (source_bucket -> RESERVADO)
    UPDATE public.stock_balances
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE location_id = v_pallet.origin_location_id 
      AND material_id = p_material_id 
      AND bucket = v_source_bucket;

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

    -- 9. RECORD PALLET ITEM
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
        updated_at = NOW();

    -- 10. RECORD IMMUTABLE STOCK MOVEMENT
    INSERT INTO public.stock_movements (
        movement_type,
        material_id,
        quantity,
        origin_location_id,
        destination_location_id,
        source_bucket,
        destination_bucket,
        pallet_id,
        demobilization_pallet_id,
        demobilization_id,
        idempotency_key,
        created_by,
        created_at
    ) VALUES (
        'RESERVA_PALLET',
        p_material_id,
        p_quantity,
        v_pallet.origin_location_id,
        v_pallet.destination_location_id,
        v_source_bucket,
        'RESERVADO',
        p_pallet_id,
        p_pallet_id,
        v_pallet.demobilization_id,
        p_idempotency_key,
        v_user_id,
        NOW()
    );

    v_result_payload := jsonb_build_object(
        'success', TRUE,
        'pallet_id', p_pallet_id,
        'material_id', p_material_id,
        'quantity', p_quantity,
        'source_bucket', v_source_bucket,
        'pallet_status', v_pallet.status
    );

    UPDATE public.operation_idempotency
    SET status = 'EXECUTED', response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key;

    RETURN v_result_payload;
END;
$$;

-- 4. MATERIAL DIMENSION IMMUTABILITY TRIGGER
-- Prevents changing width_mm or height_mm of materials already used in historical transactions
CREATE OR REPLACE FUNCTION fn_protect_used_material_dimensions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
    v_usage_count INTEGER;
BEGIN
    IF (OLD.width_mm <> NEW.width_mm) OR (OLD.height_mm <> NEW.height_mm) THEN
        SELECT COUNT(*) INTO v_usage_count
        FROM public.stock_movements
        WHERE material_id = OLD.id;

        IF v_usage_count > 0 THEN
            RAISE EXCEPTION 'Material % já possui % movimentações registradas no ledger histórico. Alterações estruturais de dimensão são proibidas para preservar a integridade histórica de m²; cadastre um novo código de material.',
                OLD.code, v_usage_count;
        END IF;
    END IF;

    -- Automatically keep unit_area_m2 strictly calculated
    NEW.unit_area_m2 := ROUND(((NEW.width_mm / 1000.0) * (NEW.height_mm / 1000.0)), 4);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_material_dimension_immutability ON public.materials;
CREATE TRIGGER trg_material_dimension_immutability
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION fn_protect_used_material_dimensions();

-- 5. LEDGER VS STOCK BALANCES RECONCILIATION AUDIT FUNCTION
CREATE OR REPLACE FUNCTION fn_audit_stock_ledger_reconciliation()
RETURNS TABLE (
    location_id UUID,
    location_name TEXT,
    material_id UUID,
    material_code TEXT,
    bucket stock_bucket,
    current_balance NUMERIC,
    in_transit_balance NUMERIC,
    discrepancy_detected BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT 
        loc.id AS location_id,
        loc.name AS location_name,
        m.id AS material_id,
        m.code AS material_code,
        sb.bucket,
        COALESCE(sb.quantity, 0) AS current_balance,
        COALESCE(st.transit_qty, 0) AS in_transit_balance,
        CASE 
            WHEN sb.quantity < 0 THEN TRUE
            ELSE FALSE
        END AS discrepancy_detected
    FROM public.locations loc
    CROSS JOIN public.materials m
    LEFT JOIN public.stock_balances sb 
        ON sb.location_id = loc.id AND sb.material_id = m.id
    LEFT JOIN (
        SELECT origin_location_id, material_id, SUM(quantity) as transit_qty
        FROM public.stock_in_transit_balances
        GROUP BY origin_location_id, material_id
    ) st ON st.origin_location_id = loc.id AND st.material_id = m.id
    WHERE (sb.quantity > 0 OR st.transit_qty > 0 OR sb.quantity < 0)
    ORDER BY loc.name, m.code, sb.bucket;
$$;

-- 6. AUDIT LOGS APPEND-ONLY SECURITY HARDENING
-- Prohibit direct updates and deletes on both audit tables
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.system_audit_logs FROM authenticated, anon;

DROP POLICY IF EXISTS "p_audit_no_update" ON public.audit_logs;
CREATE POLICY "p_audit_no_update" ON public.audit_logs FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "p_audit_no_delete" ON public.audit_logs;
CREATE POLICY "p_audit_no_delete" ON public.audit_logs FOR DELETE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "p_sys_audit_no_update" ON public.system_audit_logs;
CREATE POLICY "p_sys_audit_no_update" ON public.system_audit_logs FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "p_sys_audit_no_delete" ON public.system_audit_logs;
CREATE POLICY "p_sys_audit_no_delete" ON public.system_audit_logs FOR DELETE TO authenticated USING (FALSE);
