-- ============================================================================
-- 009_MOBILIZATION_STAGING_AND_STOCK.SQL
-- DiriDesmob Phase 2.2 - Mobilization Import Pipeline, Staging, Ledger & Stock
-- Fully Audited, Hardened & Hotfixed Implementation
-- ============================================================================

-- 1. STOCK ENUMS
DO $$ BEGIN
    CREATE TYPE stock_bucket AS ENUM (
        'DISPONIVEL',
        'RESERVADO',
        'EM_CONFERENCIA',
        'AVARIADO',
        'SUCATA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM (
        'MOBILIZACAO',
        'DESMOBILIZACAO',
        'TRANSFERENCIA',
        'AJUSTE',
        'SUCATA_BAIXA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. STOCK LEDGER (IMMUTABLE) & STOCK BALANCES (PROJECTION)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_type stock_movement_type NOT NULL,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0 AND quantity = trunc(quantity)),
    origin_location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    destination_bucket stock_bucket NOT NULL DEFAULT 'DISPONIVEL',
    mobilization_id UUID REFERENCES public.mobilizations(id) ON DELETE SET NULL,
    mobilization_pallet_id UUID REFERENCES public.mobilization_pallets(id) ON DELETE SET NULL,
    notes TEXT,
    idempotency_key TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_dest ON public.stock_movements(destination_location_id, material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_orig ON public.stock_movements(origin_location_id, material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_mob ON public.stock_movements(mobilization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_idem ON public.stock_movements(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    bucket stock_bucket NOT NULL DEFAULT 'DISPONIVEL',
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0 AND quantity = trunc(quantity)),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_balance_loc_mat_bucket UNIQUE (location_id, material_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_lookup ON public.stock_balances(location_id, material_id, bucket);

-- 3. MOBILIZATION IMPORT BATCHES & STAGING ROWS
CREATE TABLE IF NOT EXISTS public.mobilization_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_storage_path TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'VALIDATING', 'VALIDATED', 'HAS_ERRORS', 'READY_TO_COMMIT', 'COMMITTED', 'CANCELLED')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    total_pieces INTEGER NOT NULL DEFAULT 0,
    total_pallets INTEGER NOT NULL DEFAULT 0,
    total_area_m2 NUMERIC(14, 4) NOT NULL DEFAULT 0,
    committed_at TIMESTAMPTZ,
    committed_by UUID REFERENCES public.profiles(id),
    mobilization_id UUID REFERENCES public.mobilizations(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mob_import_batches_updated_at
BEFORE UPDATE ON public.mobilization_import_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Unique index to guarantee that the exact same file_hash cannot be COMMITTED more than once
CREATE UNIQUE INDEX IF NOT EXISTS uq_mob_import_batches_committed_hash 
ON public.mobilization_import_batches (file_hash) 
WHERE (status = 'COMMITTED');

CREATE INDEX IF NOT EXISTS idx_mob_import_batches_hash ON public.mobilization_import_batches(file_hash);
CREATE INDEX IF NOT EXISTS idx_mob_import_batches_work ON public.mobilization_import_batches(work_id);
CREATE INDEX IF NOT EXISTS idx_mob_import_batches_status ON public.mobilization_import_batches(status);

CREATE TABLE IF NOT EXISTS public.mobilization_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.mobilization_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_work TEXT,
    raw_origin TEXT,
    raw_destination TEXT,
    raw_pallet TEXT,
    raw_material TEXT,
    raw_quantity TEXT,
    resolved_work_id UUID REFERENCES public.locations(id),
    resolved_origin_location_id UUID REFERENCES public.locations(id),
    resolved_destination_location_id UUID REFERENCES public.locations(id),
    resolved_material_id UUID REFERENCES public.materials(id),
    quantity INTEGER CHECK (quantity IS NULL OR (quantity > 0)),
    calculated_area_m2 NUMERIC(14, 4),
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    is_duplicate_warning BOOLEAN NOT NULL DEFAULT FALSE,
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mob_import_rows_batch ON public.mobilization_import_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_mob_import_rows_valid ON public.mobilization_import_rows(batch_id, is_valid);

-- 4. EXTEND MOBILIZATIONS & PALLETS
-- Allow origin_location_id to be NULL when a mobilization contains items from multiple origins
ALTER TABLE public.mobilizations 
ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.mobilization_import_batches(id),
ADD COLUMN IF NOT EXISTS total_pieces INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pallets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_area_m2 NUMERIC(14, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.mobilizations 
ALTER COLUMN origin_location_id DROP NOT NULL;

-- Enforce pallet_number uniqueness scoped strictly within each mobilization
DO $$ BEGIN
    ALTER TABLE public.mobilization_pallets 
    ADD CONSTRAINT uq_mob_pallet_number UNIQUE (mobilization_id, pallet_number);
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- 5. AUDITED, ATOMIC & HOTFIXED COMMIT RPC FUNCTION
-- Architectural Rule:
-- Mobilization imports represent HISTORICAL / EXTERNAL entries into the destination work.
-- They record the origin_location_id in stock_movements for auditability and provenance tracking,
-- but do NOT decrement the origin location's stock_balances projection.
CREATE OR REPLACE FUNCTION fn_commit_mobilization_import(
    p_batch_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_system_role;
    v_batch RECORD;
    v_mob_id UUID;
    v_mob_code TEXT;
    v_existing_idempotency RECORD;
    v_pallet_rec RECORD;
    v_row_rec RECORD;
    v_pallet_id UUID;
    v_pallet_map JSONB := '{}'::jsonb;
    v_total_pieces INTEGER := 0;
    v_total_pallets INTEGER := 0;
    v_total_area NUMERIC(14, 4) := 0;
    v_dest_id UUID;
    v_distinct_origins_count INTEGER := 0;
    v_single_origin_id UUID := NULL;
    v_header_origin_id UUID := NULL;
    v_invalid_count INTEGER;
    v_inactive_mat_count INTEGER;
    v_inactive_dest_count INTEGER;
    v_inactive_orig_count INTEGER;
    v_unit_area NUMERIC(14, 4);
    v_row_area NUMERIC(14, 4);
    v_result_payload JSONB;
BEGIN
    -- 1. Authentication & Role Authorization Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT system_role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role NOT IN ('ADMINISTRADOR', 'ANALISTA') THEN
        RAISE EXCEPTION 'Permissão negada. Apenas Administradores e Analistas podem confirmar mobilizações.';
    END IF;

    -- 2. MANDATORY IDEMPOTENCY KEY CHECK
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key obrigatória.';
    END IF;

    -- 3. ATOMIC IDEMPOTENCY RESERVATION (Acquired at the start of transaction)
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
        'COMMIT_MOBILIZATION_IMPORT',
        'mobilization_import_batch',
        p_batch_id,
        v_user_id,
        'PROCESSING',
        NULL,
        NOW()
    )
    ON CONFLICT (operation_key) DO NOTHING;

    -- Lock the idempotency record FOR UPDATE to prevent race conditions
    SELECT * INTO v_existing_idempotency 
    FROM public.operation_idempotency 
    WHERE operation_key = p_idempotency_key 
    FOR UPDATE;

    IF FOUND THEN
        -- Validate operation type
        IF v_existing_idempotency.operation_type <> 'COMMIT_MOBILIZATION_IMPORT' THEN
            RAISE EXCEPTION 'Idempotency key já utilizada para outra operação: %', v_existing_idempotency.operation_type;
        END IF;

        -- Validate entity binding: a key can NEVER represent two different entities
        IF v_existing_idempotency.entity_type <> 'mobilization_import_batch' OR v_existing_idempotency.entity_id <> p_batch_id THEN
            RAISE EXCEPTION 'Idempotency key já vinculada a outra entidade: % (%)', v_existing_idempotency.entity_type, v_existing_idempotency.entity_id;
        END IF;

        -- If already completed/executed, return previous cached response safely
        IF v_existing_idempotency.status = 'EXECUTED' THEN
            RETURN v_existing_idempotency.response_payload;
        END IF;
    END IF;

    -- 3. Lock Batch Record FOR UPDATE & Validate State
    SELECT * INTO v_batch 
    FROM public.mobilization_import_batches 
    WHERE id = p_batch_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lote de importação não encontrado: %', p_batch_id;
    END IF;

    IF v_batch.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Lote cancelado não pode ser confirmado.';
    END IF;

    IF v_batch.status = 'COMMITTED' THEN
        RAISE EXCEPTION 'Este lote já foi confirmado anteriormente.';
    END IF;

    IF v_batch.status NOT IN ('READY_TO_COMMIT', 'VALIDATED') THEN
        RAISE EXCEPTION 'O lote não está pronto para ser confirmado. Status atual: %', v_batch.status;
    END IF;

    IF v_batch.invalid_rows > 0 THEN
        RAISE EXCEPTION 'Não é permitido confirmar um lote que possui % linha(s) com erro.', v_batch.invalid_rows;
    END IF;

    -- 4. Check if duplicate file_hash has already been committed in another batch
    IF EXISTS (
        SELECT 1 FROM public.mobilization_import_batches 
        WHERE file_hash = v_batch.file_hash 
          AND status = 'COMMITTED' 
          AND id <> v_batch.id
    ) THEN
        RAISE EXCEPTION 'Arquivo duplicado: este mesmo arquivo (SHA-256: %) já foi confirmado anteriormente no sistema.', v_batch.file_hash;
    END IF;

    -- 5. Strict Comprehensive Server-Side Staging Re-validation (No Blind Trust in Browser)
    -- A. Validate all rows: is_valid, integer quantity > 0, non-null resolved references, non-empty pallet
    SELECT COUNT(*) INTO v_invalid_count
    FROM public.mobilization_import_rows
    WHERE batch_id = p_batch_id 
      AND (
        is_valid = FALSE 
        OR quantity IS NULL 
        OR quantity <= 0 
        OR quantity <> trunc(quantity)
        OR resolved_origin_location_id IS NULL
        OR resolved_destination_location_id IS NULL
        OR resolved_material_id IS NULL
        OR raw_pallet IS NULL
        OR TRIM(raw_pallet) = ''
      );

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Backend Validation: O lote contém % linha(s) inválidas, sem origem/destino/material ou com quantidades inconsistentes.', v_invalid_count;
    END IF;

    -- B. Verify all referenced materials exist and are active
    SELECT COUNT(*) INTO v_inactive_mat_count
    FROM public.mobilization_import_rows r
    LEFT JOIN public.materials m ON m.id = r.resolved_material_id
    WHERE r.batch_id = p_batch_id 
      AND (m.id IS NULL OR m.is_active = FALSE);

    IF v_inactive_mat_count > 0 THEN
        RAISE EXCEPTION 'Backend Validation: Existem materiais inexistentes ou inativos associados às linhas deste lote.';
    END IF;

    -- C. Verify all referenced destination locations exist, are active and of type OBRA
    SELECT COUNT(*) INTO v_inactive_dest_count
    FROM public.mobilization_import_rows r
    LEFT JOIN public.locations l ON l.id = r.resolved_destination_location_id
    WHERE r.batch_id = p_batch_id 
      AND (l.id IS NULL OR l.is_active = FALSE OR l.type <> 'OBRA');

    IF v_inactive_dest_count > 0 THEN
        RAISE EXCEPTION 'Backend Validation: Existem destinos inexistentes, inativos ou que não são do tipo OBRA.';
    END IF;

    -- D. Verify all referenced origin locations exist and are active (NO SILENT FALLBACK)
    SELECT COUNT(*) INTO v_inactive_orig_count
    FROM public.mobilization_import_rows r
    LEFT JOIN public.locations l ON l.id = r.resolved_origin_location_id
    WHERE r.batch_id = p_batch_id 
      AND (l.id IS NULL OR l.is_active = FALSE);

    IF v_inactive_orig_count > 0 THEN
        RAISE EXCEPTION 'Backend Validation: Existem origens inexistentes ou inativas associadas às linhas deste lote.';
    END IF;

    -- E. Verify destination location matches batch work_id if set
    IF v_batch.work_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.mobilization_import_rows r
        WHERE r.batch_id = p_batch_id AND r.resolved_destination_location_id <> v_batch.work_id
    ) THEN
        RAISE EXCEPTION 'Backend Validation: Existem linhas cujo destino difere da obra vinculada ao lote.';
    END IF;

    -- 6. Origin Resolution: Multiple Origins Support vs Single Origin (No Silent Fallback)
    SELECT 
        COUNT(DISTINCT resolved_origin_location_id),
        MIN(resolved_origin_location_id)
    INTO v_distinct_origins_count, v_single_origin_id
    FROM public.mobilization_import_rows
    WHERE batch_id = p_batch_id AND is_valid = TRUE;

    IF v_distinct_origins_count = 1 THEN
        v_header_origin_id := v_single_origin_id;
    ELSE
        v_header_origin_id := NULL; -- Explicitly NULL to represent Multiple Origins in header
    END IF;

    -- Destination is the work_id
    SELECT resolved_destination_location_id INTO v_dest_id
    FROM public.mobilization_import_rows
    WHERE batch_id = p_batch_id AND is_valid = TRUE
    LIMIT 1;

    IF v_dest_id IS NULL THEN
        v_dest_id := v_batch.work_id;
    END IF;

    -- 7. Generate Mobilization Code (MOB-YYYYMMDD-XXXX)
    v_mob_code := 'MOB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');

    -- 8. Insert Mobilization Record
    INSERT INTO public.mobilizations (
        code,
        destination_work_id,
        origin_location_id,
        status,
        import_batch_id,
        total_pieces,
        total_pallets,
        total_area_m2,
        notes,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_mob_code,
        v_dest_id,
        v_header_origin_id,
        'CONCLUIDA',
        p_batch_id,
        v_batch.total_pieces,
        v_batch.total_pallets,
        v_batch.total_area_m2,
        'Importação automatizada via Excel: ' || v_batch.file_name,
        v_user_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_mob_id;

    -- 9. Create Mobilization Pallets (Scoped unique within this mobilization with internal UUID)
    FOR v_pallet_rec IN 
        SELECT DISTINCT TRIM(raw_pallet) AS pallet_number
        FROM public.mobilization_import_rows
        WHERE batch_id = p_batch_id AND is_valid = TRUE
        ORDER BY pallet_number
    LOOP
        INSERT INTO public.mobilization_pallets (
            mobilization_id,
            pallet_number,
            created_at
        ) VALUES (
            v_mob_id,
            v_pallet_rec.pallet_number,
            NOW()
        ) RETURNING id INTO v_pallet_id;

        -- Store map of pallet_number -> internal pallet UUID
        v_pallet_map := jsonb_set(v_pallet_map, ARRAY[v_pallet_rec.pallet_number], to_jsonb(v_pallet_id::text));
    END LOOP;

    -- 10. Process Items, Ledger Stock Movements & Atomic Stock Balances Projection
    FOR v_row_rec IN 
        SELECT 
            r.*,
            m.unit_area_m2 AS catalog_unit_area
        FROM public.mobilization_import_rows r
        JOIN public.materials m ON m.id = r.resolved_material_id
        WHERE r.batch_id = p_batch_id AND r.is_valid = TRUE
        ORDER BY r.row_number ASC
    LOOP
        -- Get mapped internal pallet ID
        v_pallet_id := (v_pallet_map->>TRIM(v_row_rec.raw_pallet))::UUID;

        -- Strictly calculate area from catalog unit_area_m2 * quantity
        v_unit_area := COALESCE(v_row_rec.catalog_unit_area, 0);
        v_row_area := ROUND((v_unit_area * v_row_rec.quantity)::numeric, 4);

        v_total_pieces := v_total_pieces + v_row_rec.quantity;
        v_total_area := v_total_area + v_row_area;

        -- A. Insert Mobilization Item
        INSERT INTO public.mobilization_items (
            mobilization_pallet_id,
            material_id,
            quantity,
            created_at
        ) VALUES (
            v_pallet_id,
            v_row_rec.resolved_material_id,
            v_row_rec.quantity,
            NOW()
        );

        -- B. Insert Stock Movement (Immutable Ledger Entry with specific row origin)
        INSERT INTO public.stock_movements (
            movement_type,
            material_id,
            quantity,
            origin_location_id,
            destination_location_id,
            destination_bucket,
            mobilization_id,
            mobilization_pallet_id,
            notes,
            idempotency_key,
            created_by,
            created_at
        ) VALUES (
            'MOBILIZACAO',
            v_row_rec.resolved_material_id,
            v_row_rec.quantity,
            v_row_rec.resolved_origin_location_id,
            v_row_rec.resolved_destination_location_id,
            'DISPONIVEL',
            v_mob_id,
            v_pallet_id,
            'Mobilização via arquivo ' || v_batch.file_name || ' (Pallet ' || TRIM(v_row_rec.raw_pallet) || ')',
            p_idempotency_key,
            v_user_id,
            NOW()
        );

        -- C. Update Stock Balance Projection (Atomic Row-Lock & UPSERT)
        -- Increases exclusively destination location with bucket 'DISPONIVEL'
        INSERT INTO public.stock_balances (
            location_id,
            material_id,
            bucket,
            quantity,
            updated_at
        ) VALUES (
            v_row_rec.resolved_destination_location_id,
            v_row_rec.resolved_material_id,
            'DISPONIVEL',
            v_row_rec.quantity,
            NOW()
        )
        ON CONFLICT (location_id, material_id, bucket)
        DO UPDATE SET 
            quantity = public.stock_balances.quantity + EXCLUDED.quantity,
            updated_at = NOW();

    END LOOP;

    -- 11. Update Mobilization Totals with exact verified numbers
    SELECT count(DISTINCT id) INTO v_total_pallets FROM public.mobilization_pallets WHERE mobilization_id = v_mob_id;

    UPDATE public.mobilizations
    SET 
        total_pieces = v_total_pieces,
        total_pallets = v_total_pallets,
        total_area_m2 = v_total_area,
        updated_at = NOW()
    WHERE id = v_mob_id;

    -- 12. Mark Import Batch as COMMITTED
    UPDATE public.mobilization_import_batches
    SET 
        status = 'COMMITTED',
        total_pieces = v_total_pieces,
        total_pallets = v_total_pallets,
        total_area_m2 = v_total_area,
        committed_at = NOW(),
        committed_by = v_user_id,
        mobilization_id = v_mob_id,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- 13. Audit Log Entry (Append-Only)
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_table,
        entity_id,
        new_data,
        created_at
    ) VALUES (
        v_user_id,
        'MOBILIZATION_IMPORT_COMMIT',
        'mobilizations',
        v_mob_id,
        jsonb_build_object(
            'batch_id', p_batch_id,
            'mobilization_code', v_mob_code,
            'work_id', v_dest_id,
            'file_name', v_batch.file_name,
            'file_hash', v_batch.file_hash,
            'total_pieces', v_total_pieces,
            'total_pallets', v_total_pallets,
            'total_area_m2', v_total_area,
            'multiple_origins', (v_distinct_origins_count > 1),
            'committed_by', v_user_id,
            'committed_at', NOW()
        ),
        NOW()
    );

    -- 14. Finalize Idempotency Entry (UPDATE status to EXECUTED and check exactly 1 row updated)
    v_result_payload := jsonb_build_object(
        'success', true,
        'mobilization_id', v_mob_id,
        'mobilization_code', v_mob_code,
        'batch_id', p_batch_id,
        'total_pieces', v_total_pieces,
        'total_pallets', v_total_pallets,
        'total_area_m2', v_total_area
    );

    UPDATE public.operation_idempotency
    SET 
        status = 'EXECUTED',
        response_payload = v_result_payload
    WHERE operation_key = p_idempotency_key
      AND operation_type = 'COMMIT_MOBILIZATION_IMPORT'
      AND entity_type = 'mobilization_import_batch'
      AND entity_id = p_batch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Falha ao atualizar registro de idempotência para o lote %.', p_batch_id;
    END IF;

    -- 15. Return Success Payload
    RETURN v_result_payload;
END;
$$;

-- 6. STRICT ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilization_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilization_import_rows ENABLE ROW LEVEL SECURITY;

-- Stock Movements RLS
DROP POLICY IF EXISTS "p_stock_movements_sel" ON public.stock_movements;
CREATE POLICY "p_stock_movements_sel" ON public.stock_movements
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR
    auth_user_has_location_access(destination_location_id) OR
    (origin_location_id IS NOT NULL AND auth_user_has_location_access(origin_location_id))
);

DROP POLICY IF EXISTS "p_stock_movements_block_write" ON public.stock_movements;
CREATE POLICY "p_stock_movements_block_write" ON public.stock_movements
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- Stock Balances RLS
DROP POLICY IF EXISTS "p_stock_balances_sel" ON public.stock_balances;
CREATE POLICY "p_stock_balances_sel" ON public.stock_balances
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR
    auth_user_has_location_access(location_id)
);

DROP POLICY IF EXISTS "p_stock_balances_block_write" ON public.stock_balances;
CREATE POLICY "p_stock_balances_block_write" ON public.stock_balances
FOR ALL TO authenticated
USING (FALSE) WITH CHECK (FALSE);

-- STAGING PRIVADO: Acesso EXCLUSIVO para ADMINISTRADOR e ANALISTA
-- Usuários de Obra NÃO devem acessar staging em hipótese alguma
DROP POLICY IF EXISTS "p_mob_batches_sel" ON public.mobilization_import_batches;
CREATE POLICY "p_mob_batches_sel" ON public.mobilization_import_batches
FOR SELECT TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_batches_ins" ON public.mobilization_import_batches;
CREATE POLICY "p_mob_batches_ins" ON public.mobilization_import_batches
FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_batches_upd" ON public.mobilization_import_batches;
CREATE POLICY "p_mob_batches_upd" ON public.mobilization_import_batches
FOR UPDATE TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'))
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_batches_del" ON public.mobilization_import_batches;
CREATE POLICY "p_mob_batches_del" ON public.mobilization_import_batches
FOR DELETE TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') AND status <> 'COMMITTED');

-- Import Rows RLS: EXCLUSIVO ADMINISTRADOR e ANALISTA
DROP POLICY IF EXISTS "p_mob_rows_sel" ON public.mobilization_import_rows;
CREATE POLICY "p_mob_rows_sel" ON public.mobilization_import_rows
FOR SELECT TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_rows_ins" ON public.mobilization_import_rows;
CREATE POLICY "p_mob_rows_ins" ON public.mobilization_import_rows
FOR INSERT TO authenticated
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_rows_del" ON public.mobilization_import_rows;
CREATE POLICY "p_mob_rows_del" ON public.mobilization_import_rows
FOR DELETE TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

-- Mobilizations & Pallets RLS (Pós-Commit: Usuários da Obra consultam apenas sua Obra)
DROP POLICY IF EXISTS "p_mobilizations_sel" ON public.mobilizations;
CREATE POLICY "p_mobilizations_sel" ON public.mobilizations
FOR SELECT TO authenticated
USING (
    auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR
    auth_user_has_location_access(destination_work_id) OR
    (origin_location_id IS NOT NULL AND auth_user_has_location_access(origin_location_id))
);

DROP POLICY IF EXISTS "p_mobilizations_adm" ON public.mobilizations;
CREATE POLICY "p_mobilizations_adm" ON public.mobilizations
FOR ALL TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'))
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_pallets_sel" ON public.mobilization_pallets;
CREATE POLICY "p_mob_pallets_sel" ON public.mobilization_pallets
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.mobilizations m 
        WHERE m.id = mobilization_id 
          AND (
            auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
            auth_user_has_location_access(m.destination_work_id) OR
            (m.origin_location_id IS NOT NULL AND auth_user_has_location_access(m.origin_location_id))
          )
    )
);

DROP POLICY IF EXISTS "p_mob_pallets_adm" ON public.mobilization_pallets;
CREATE POLICY "p_mob_pallets_adm" ON public.mobilization_pallets
FOR ALL TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'))
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

DROP POLICY IF EXISTS "p_mob_items_sel" ON public.mobilization_items;
CREATE POLICY "p_mob_items_sel" ON public.mobilization_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.mobilization_pallets p
        JOIN public.mobilizations m ON m.id = p.mobilization_id
        WHERE p.id = mobilization_pallet_id
          AND (
            auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA') OR 
            auth_user_has_location_access(m.destination_work_id) OR
            (m.origin_location_id IS NOT NULL AND auth_user_has_location_access(m.origin_location_id))
          )
    )
);

DROP POLICY IF EXISTS "p_mob_items_adm" ON public.mobilization_items;
CREATE POLICY "p_mob_items_adm" ON public.mobilization_items
FOR ALL TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'))
WITH CHECK (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));
