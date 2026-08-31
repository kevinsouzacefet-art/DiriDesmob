-- ============================================================================
-- 011_IDEMPOTENCY_ENTITY_LINK.SQL
-- DiriDesmob Phase 2.2 - Explicit Entity Binding for Idempotency
-- ============================================================================

-- 1. ADD EXPLICIT ENTITY BINDING TO OPERATION_IDEMPOTENCY
ALTER TABLE public.operation_idempotency 
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Backfill legacy records if any exist
UPDATE public.operation_idempotency 
SET 
    entity_type = 'mobilization_import_batch',
    entity_id = (response_payload->>'batch_id')::UUID
WHERE entity_type IS NULL 
  AND operation_type = 'COMMIT_MOBILIZATION_IMPORT' 
  AND response_payload->>'batch_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operation_idempotency_entity 
ON public.operation_idempotency(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_operation_idempotency_type_key 
ON public.operation_idempotency(operation_type, operation_key);

-- 2. HARDENED ATOMIC COMMIT RPC WITH EXPLICIT ENTITY BINDING & MANDATORY KEY
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

    -- 4. Lock Batch Record FOR UPDATE & Validate State
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

    -- 5. Check if duplicate file_hash has already been committed in another batch
    IF EXISTS (
        SELECT 1 FROM public.mobilization_import_batches 
        WHERE file_hash = v_batch.file_hash 
          AND status = 'COMMITTED' 
          AND id <> v_batch.id
    ) THEN
        RAISE EXCEPTION 'Arquivo duplicado: este mesmo arquivo (SHA-256: %) já foi confirmado anteriormente no sistema.', v_batch.file_hash;
    END IF;

    -- 6. Strict Comprehensive Server-Side Staging Re-validation (No Blind Trust in Browser)
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

    -- 7. Origin Resolution: Multiple Origins Support vs Single Origin (No Silent Fallback)
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

    -- 8. Generate Mobilization Code (MOB-YYYYMMDD-XXXX)
    v_mob_code := 'MOB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');

    -- 9. Insert Mobilization Record
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

    -- 10. Create Mobilization Pallets (Scoped unique within this mobilization with internal UUID)
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

    -- 11. Process Items, Ledger Stock Movements & Atomic Stock Balances Projection
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

    -- 12. Update Mobilization Totals with exact verified numbers
    SELECT count(DISTINCT id) INTO v_total_pallets FROM public.mobilization_pallets WHERE mobilization_id = v_mob_id;

    UPDATE public.mobilizations
    SET 
        total_pieces = v_total_pieces,
        total_pallets = v_total_pallets,
        total_area_m2 = v_total_area,
        updated_at = NOW()
    WHERE id = v_mob_id;

    -- 13. Mark Import Batch as COMMITTED
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

    -- 14. Audit Log Entry (Append-Only)
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

    -- 15. Finalize Idempotency Entry (UPDATE status to EXECUTED and check exactly 1 row updated)
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

    -- 16. Return Success Payload
    RETURN v_result_payload;
END;
$$;
