-- ============================================================================
-- 016_DASHBOARDS_REPORTS_SUPPLIER_COSTS_AND_AUDIT.SQL
-- Phase 2.7: Real-data KPIs, Supplier Service Costs, Auditing, Indexes & Reports
-- ============================================================================

-- 1. SUPPLIER SERVICE RATES
-- Stores historical rates per m2 for each supplier with strict non-overlapping validation
CREATE TABLE IF NOT EXISTS public.supplier_service_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    rate_per_m2 NUMERIC(12, 4) NOT NULL CHECK (rate_per_m2 >= 0),
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_supplier_rate_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_supplier_rates_supplier ON public.supplier_service_rates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rates_dates ON public.supplier_service_rates(valid_from, valid_to);

-- Validation Trigger: Prevent overlapping rate periods for the same supplier
CREATE OR REPLACE FUNCTION fn_validate_supplier_rate_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.supplier_service_rates
    WHERE supplier_id = NEW.supplier_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
          -- NEW range overlaps with existing range
          (NEW.valid_to IS NULL AND (valid_to IS NULL OR valid_to >= NEW.valid_from))
          OR
          (NEW.valid_to IS NOT NULL AND valid_from <= NEW.valid_to AND COALESCE(valid_to, '9999-12-31'::DATE) >= NEW.valid_from)
      );

    IF v_overlap_count > 0 THEN
        RAISE EXCEPTION 'Conflito de vigência: Já existe uma taxa de serviço cadastrada para este fornecedor no período informado (% até %).',
            NEW.valid_from, COALESCE(NEW.valid_to::TEXT, 'vigente');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supplier_rate_overlap ON public.supplier_service_rates;
CREATE TRIGGER trg_validate_supplier_rate_overlap
BEFORE INSERT OR UPDATE ON public.supplier_service_rates
FOR EACH ROW EXECUTE FUNCTION fn_validate_supplier_rate_overlap();


-- 2. SUPPLIER SERVICE COSTS (SNAPSHOTS)
-- Immutable operational cost snapshot per conference/load
CREATE TABLE IF NOT EXISTS public.supplier_service_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    conference_id UUID NOT NULL REFERENCES public.load_conferences(id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    received_area_m2 NUMERIC(12, 4) NOT NULL DEFAULT 0,
    applied_rate_per_m2 NUMERIC(12, 4),
    calculated_value NUMERIC(12, 2),
    status TEXT NOT NULL DEFAULT 'CALCULADO' CHECK (status IN ('CALCULADO', 'PENDENTE_DE_TAXA', 'RECALCULADO')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supplier_service_cost_conf UNIQUE (conference_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_costs_supplier ON public.supplier_service_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_costs_load ON public.supplier_service_costs(load_id);
CREATE INDEX IF NOT EXISTS idx_supplier_costs_status ON public.supplier_service_costs(status);
CREATE INDEX IF NOT EXISTS idx_supplier_costs_date ON public.supplier_service_costs(service_date);

-- 3. FUNCTION TO CALCULATE SUPPLIER SERVICE COST (SNAPSHOT)
CREATE OR REPLACE FUNCTION fn_calculate_supplier_service_cost(
    p_conference_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_conf public.load_conferences%ROWTYPE;
    v_load public.loads%ROWTYPE;
    v_supplier_loc public.locations%ROWTYPE;
    v_total_received_area NUMERIC(12, 4) := 0;
    v_rate public.supplier_service_rates%ROWTYPE;
    v_service_date DATE;
    v_cost_status TEXT;
    v_applied_rate NUMERIC(12, 4) := NULL;
    v_calculated_val NUMERIC(12, 2) := NULL;
    v_cost_id UUID;
BEGIN
    SELECT * INTO v_conf FROM public.load_conferences WHERE id = p_conference_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conferência não encontrada: %', p_conference_id;
    END IF;

    SELECT * INTO v_load FROM public.loads WHERE id = v_conf.load_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carga vinculada não encontrada: %', v_conf.load_id;
    END IF;

    -- Check if destination is a FORNECEDOR
    SELECT * INTO v_supplier_loc FROM public.locations WHERE id = v_load.destination_location_id;
    IF NOT FOUND OR v_supplier_loc.type <> 'FORNECEDOR' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Destino da conferência não é um fornecedor.');
    END IF;

    v_service_date := COALESCE(v_conf.finished_at::DATE, v_conf.started_at::DATE, CURRENT_DATE);

    -- Calculate total received area m2 based purely on physically received items in conference
    SELECT COALESCE(SUM(COALESCE(pci.received_qty, 0) * m.unit_area_m2), 0)
    INTO v_total_received_area
    FROM public.pallet_conference_items pci
    JOIN public.pallet_conferences pc ON pc.id = pci.pallet_conference_id
    JOIN public.materials m ON m.id = pci.material_id
    WHERE pc.conference_id = p_conference_id;

    -- Find active rate for the supplier on the service date
    SELECT * INTO v_rate
    FROM public.supplier_service_rates
    WHERE supplier_id = v_supplier_loc.id
      AND v_service_date >= valid_from
      AND (valid_to IS NULL OR v_service_date <= valid_to)
    ORDER BY valid_from DESC
    LIMIT 1;

    IF FOUND THEN
        v_applied_rate := v_rate.rate_per_m2;
        v_calculated_val := ROUND((v_total_received_area * v_rate.rate_per_m2), 2);
        v_cost_status := 'CALCULADO';
    ELSE
        v_applied_rate := NULL;
        v_calculated_val := NULL;
        v_cost_status := 'PENDENTE_DE_TAXA';
    END IF;

    -- Upsert snapshot into supplier_service_costs
    INSERT INTO public.supplier_service_costs (
        supplier_id,
        load_id,
        conference_id,
        service_date,
        received_area_m2,
        applied_rate_per_m2,
        calculated_value,
        status,
        updated_at
    )
    VALUES (
        v_supplier_loc.id,
        v_load.id,
        v_conf.id,
        v_service_date,
        v_total_received_area,
        v_applied_rate,
        v_calculated_val,
        v_cost_status,
        NOW()
    )
    ON CONFLICT (conference_id) DO UPDATE SET
        received_area_m2 = EXCLUDED.received_area_m2,
        applied_rate_per_m2 = EXCLUDED.applied_rate_per_m2,
        calculated_value = EXCLUDED.calculated_value,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO v_cost_id;

    RETURN jsonb_build_object(
        'success', true,
        'cost_id', v_cost_id,
        'status', v_cost_status,
        'received_area_m2', v_total_received_area,
        'applied_rate_per_m2', v_applied_rate,
        'calculated_value', v_calculated_val
    );
END;
$$;


-- 4. RECALCULATE PENDING SUPPLIER SERVICE COSTS AFTER RATE REGISTRATION
CREATE OR REPLACE FUNCTION fn_recalculate_pending_supplier_service_costs(
    p_supplier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_rec RECORD;
    v_updated_count INTEGER := 0;
    v_rate public.supplier_service_rates%ROWTYPE;
BEGIN
    FOR v_rec IN
        SELECT * FROM public.supplier_service_costs
        WHERE supplier_id = p_supplier_id
          AND status = 'PENDENTE_DE_TAXA'
    LOOP
        SELECT * INTO v_rate
        FROM public.supplier_service_rates
        WHERE supplier_id = p_supplier_id
          AND v_rec.service_date >= valid_from
          AND (valid_to IS NULL OR v_rec.service_date <= valid_to)
        ORDER BY valid_from DESC
        LIMIT 1;

        IF FOUND THEN
            UPDATE public.supplier_service_costs
            SET applied_rate_per_m2 = v_rate.rate_per_m2,
                calculated_value = ROUND((received_area_m2 * v_rate.rate_per_m2), 2),
                status = 'CALCULADO',
                updated_at = NOW()
            WHERE id = v_rec.id;

            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'recalculated_count', v_updated_count
    );
END;
$$;


-- 5. TRIGGER ON CONFERENCE FINALIZATION TO AUTO-TRIGGER SUPPLIER COST SNAPSHOT
CREATE OR REPLACE FUNCTION fn_trg_conference_completed_supplier_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'CONCLUIDA' AND (OLD.status IS NULL OR OLD.status <> 'CONCLUIDA') THEN
        PERFORM public.fn_calculate_supplier_service_cost(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conference_completed_supplier_cost ON public.load_conferences;
CREATE TRIGGER trg_conference_completed_supplier_cost
AFTER INSERT OR UPDATE OF status ON public.load_conferences
FOR EACH ROW EXECUTE FUNCTION fn_trg_conference_completed_supplier_cost();


-- 6. REAL-DATA ADMIN DASHBOARD AGGREGATION RPC
CREATE OR REPLACE FUNCTION fn_get_admin_dashboard_kpis(
    p_period_start TIMESTAMPTZ DEFAULT NULL,
    p_period_end TIMESTAMPTZ DEFAULT NULL,
    p_work_id UUID DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_total_mobilized_pieces NUMERIC(12, 2) := 0;
    v_completed_works_count BIGINT := 0;
    v_demobilizing_works_count BIGINT := 0;
    v_loads_per_day NUMERIC(10, 2) := 0;
    v_pieces_at_works NUMERIC(12, 2) := 0;
    v_total_pallets BIGINT := 0;
    v_pieces_in_transit NUMERIC(12, 2) := 0;
    v_pieces_at_suppliers NUMERIC(12, 2) := 0;
    v_loss_cost_total NUMERIC(12, 2) := 0;
    v_divergence_rate NUMERIC(10, 2) := 0;
    v_pending_loads_count BIGINT := 0;
    v_delayed_loads_count BIGINT := 0;
    v_mobilized_area_m2 NUMERIC(12, 2) := 0;
    v_demobilized_area_m2 NUMERIC(12, 2) := 0;
    v_top_loss_ranking JSONB := '[]'::JSONB;
    v_total_conf_items BIGINT := 0;
    v_total_divergent_items BIGINT := 0;
    v_total_loads_in_period BIGINT := 0;
    v_days_count NUMERIC := 30;
BEGIN
    -- 1. Completed Works
    SELECT COUNT(*) INTO v_completed_works_count
    FROM public.works
    WHERE status = 'CONCLUIDA';

    -- 2. Demobilizing Works (Active works undergoing demobilization)
    SELECT COUNT(DISTINCT work_id) INTO v_demobilizing_works_count
    FROM public.demobilizations
    WHERE status IN ('PLANEJADA', 'EM_ANDAMENTO');

    -- 3. Pieces at Works (Physical stock at OBRA locations)
    SELECT COALESCE(SUM(sb.quantity), 0) INTO v_pieces_at_works
    FROM public.stock_balances sb
    JOIN public.locations l ON l.id = sb.location_id
    WHERE l.type = 'OBRA'
      AND (p_work_id IS NULL OR l.id = p_work_id);

    -- 4. Pieces at Suppliers (Physical stock at FORNECEDOR locations)
    SELECT COALESCE(SUM(sb.quantity), 0) INTO v_pieces_at_suppliers
    FROM public.stock_balances sb
    JOIN public.locations l ON l.id = sb.location_id
    WHERE l.type = 'FORNECEDOR'
      AND (p_supplier_id IS NULL OR l.id = p_supplier_id);

    -- 5. Pieces in Transit (stock_in_transit_balances)
    SELECT COALESCE(SUM(quantity), 0) INTO v_pieces_in_transit
    FROM public.stock_in_transit_balances;

    -- 6. Total Pallets
    SELECT COUNT(*) INTO v_total_pallets
    FROM public.demobilization_pallets dp
    WHERE (p_work_id IS NULL OR dp.origin_location_id = p_work_id);

    -- 7. Pending Loads (RASCUNHO, PRONTA_PARA_ENVIO)
    SELECT COUNT(*) INTO v_pending_loads_count
    FROM public.loads
    WHERE status IN ('RASCUNHO', 'PRONTA_PARA_ENVIO')
      AND (p_work_id IS NULL OR origin_location_id = p_work_id OR destination_location_id = p_work_id);

    -- 8. Delayed Loads (expected_arrival_date < CURRENT_DATE and status still in transit/open)
    SELECT COUNT(*) INTO v_delayed_loads_count
    FROM public.loads
    WHERE expected_arrival_date IS NOT NULL
      AND expected_arrival_date < CURRENT_DATE
      AND status IN ('DESPACHADA', 'EM_TRANSITO')
      AND (p_work_id IS NULL OR origin_location_id = p_work_id OR destination_location_id = p_work_id);

    -- 9. Loss Cost Total
    SELECT COALESCE(SUM(calculated_value), 0) INTO v_loss_cost_total
    FROM public.losses l
    WHERE (p_work_id IS NULL OR l.work_id = p_work_id)
      AND (p_period_start IS NULL OR l.created_at >= p_period_start)
      AND (p_period_end IS NULL OR l.created_at <= p_period_end);

    -- 10. Divergence Rate (Divergences / Total Conference Items checked)
    SELECT COUNT(*) INTO v_total_conf_items
    FROM public.pallet_conference_items;

    SELECT COUNT(*) INTO v_total_divergent_items
    FROM public.divergences;

    IF v_total_conf_items > 0 THEN
        v_divergence_rate := ROUND(((v_total_divergent_items::NUMERIC / v_total_conf_items::NUMERIC) * 100), 2);
    ELSE
        v_divergence_rate := 0;
    END IF;

    -- 11. Mobilized & Demobilized Pieces and Area m2
    SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(quantity * m.unit_area_m2), 0)
    INTO v_total_mobilized_pieces, v_mobilized_area_m2
    FROM public.mobilization_items mi
    JOIN public.materials m ON m.id = mi.material_id;

    SELECT COALESCE(SUM(dpi.quantity * m.unit_area_m2), 0)
    INTO v_demobilized_area_m2
    FROM public.demobilization_pallet_items dpi
    JOIN public.materials m ON m.id = dpi.material_id;

    -- 12. Loads per day
    IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL THEN
        v_days_count := GREATEST(1, EXTRACT(DAY FROM (p_period_end - p_period_start)));
    END IF;

    SELECT COUNT(*) INTO v_total_loads_in_period
    FROM public.loads
    WHERE (p_period_start IS NULL OR created_at >= p_period_start)
      AND (p_period_end IS NULL OR created_at <= p_period_end);

    v_loads_per_day := ROUND((v_total_loads_in_period::NUMERIC / v_days_count::NUMERIC), 2);

    -- 13. Top 5 Worst Works by Loss Value and documented Loss %
    WITH work_losses AS (
        SELECT
            l.work_id,
            loc.code AS work_code,
            loc.name AS work_name,
            COALESCE(SUM(l.calculated_value), 0) AS total_loss_val,
            COUNT(DISTINCT l.id) AS loss_count,
            COUNT(DISTINCT l.divergence_id) AS div_count
        FROM public.losses l
        JOIN public.locations loc ON loc.id = l.work_id
        GROUP BY l.work_id, loc.code, loc.name
    ),
    work_mobilized AS (
        SELECT
            mob.destination_work_id AS work_id,
            COALESCE(SUM(mi.quantity * m.unit_area_m2), 0) AS total_mob_area_m2,
            COALESCE(SUM(mi.quantity * m.unit_area_m2 * 100), 0) AS estimated_mob_val
        FROM public.mobilizations mob
        JOIN public.mobilization_pallets mp ON mp.mobilization_id = mob.id
        JOIN public.mobilization_items mi ON mi.pallet_id = mp.id
        JOIN public.materials m ON m.id = mi.material_id
        GROUP BY mob.destination_work_id
    ),
    work_totals AS (
        SELECT
            wl.work_id,
            wl.work_code,
            wl.work_name,
            wl.total_loss_val,
            wl.div_count,
            -- Loss % calculated as (loss_val / estimated_mob_val) * 100
            CASE
                WHEN COALESCE(wm.estimated_mob_val, 0) > 0 THEN
                    ROUND(((wl.total_loss_val / wm.estimated_mob_val) * 100), 2)
                ELSE
                    0
            END AS loss_pct
        FROM work_losses wl
        LEFT JOIN work_mobilized wm ON wm.work_id = wl.work_id
        ORDER BY wl.total_loss_val DESC
        LIMIT 5
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'workId', work_id,
            'workCode', work_code,
            'workName', work_name,
            'lossValue', total_loss_val,
            'lossPercentage', loss_pct,
            'divergencesCount', div_count
        )
    ), '[]'::JSONB) INTO v_top_loss_ranking
    FROM work_totals;

    RETURN jsonb_build_object(
        'totalMobilizedPieces', v_total_mobilized_pieces,
        'completedWorks', v_completed_works_count,
        'demobilizingWorks', v_demobilizing_works_count,
        'loadsPerDay', v_loads_per_day,
        'piecesAtWorks', v_pieces_at_works,
        'totalPallets', v_total_pallets,
        'piecesInTransit', v_pieces_in_transit,
        'piecesAtSuppliers', v_pieces_at_suppliers,
        'lossCostTotal', v_loss_cost_total,
        'divergenceRate', v_divergence_rate,
        'pendingLoads', v_pending_loads_count,
        'delayedLoads', v_delayed_loads_count,
        'mobilizedAreaM2', v_mobilized_area_m2,
        'demobilizedAreaM2', v_demobilized_area_m2,
        'topLossRanking', v_top_loss_ranking
    );
END;
$$;


-- 7. AUDIT LOG SECURITY: Append-only enforcement
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_audit_logs_read ON public.audit_logs;
CREATE POLICY p_audit_logs_read ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.system_role IN ('ADMINISTRADOR', 'ANALISTA')
        )
    );

DROP POLICY IF EXISTS p_audit_logs_insert ON public.audit_logs;
CREATE POLICY p_audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Explicitly disallow UPDATE and DELETE on audit_logs
DROP POLICY IF EXISTS p_audit_logs_no_update ON public.audit_logs;
DROP POLICY IF EXISTS p_audit_logs_no_delete ON public.audit_logs;


-- 8. RLS POLICIES FOR SUPPLIER SERVICE RATES AND COSTS
ALTER TABLE public.supplier_service_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_service_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_rates_select ON public.supplier_service_rates;
CREATE POLICY p_rates_select ON public.supplier_service_rates
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                  p.system_role IN ('ADMINISTRADOR', 'ANALISTA')
                  OR (
                      p.system_role IN ('FORNECEDOR_SUPERVISOR', 'FORNECEDOR_CONFERENTE')
                      AND EXISTS (
                          SELECT 1 FROM public.user_location_access ula
                          WHERE ula.user_id = auth.uid()
                            AND ula.location_id = supplier_id
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS p_rates_admin_all ON public.supplier_service_rates;
CREATE POLICY p_rates_admin_all ON public.supplier_service_rates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.system_role = 'ADMINISTRADOR'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.system_role = 'ADMINISTRADOR'
        )
    );

DROP POLICY IF EXISTS p_costs_select ON public.supplier_service_costs;
CREATE POLICY p_costs_select ON public.supplier_service_costs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                  p.system_role IN ('ADMINISTRADOR', 'ANALISTA')
                  OR (
                      p.system_role IN ('FORNECEDOR_SUPERVISOR', 'FORNECEDOR_CONFERENTE')
                      AND EXISTS (
                          SELECT 1 FROM public.user_location_access ula
                          WHERE ula.user_id = auth.uid()
                            AND ula.location_id = supplier_id
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS p_costs_admin_all ON public.supplier_service_costs;
CREATE POLICY p_costs_admin_all ON public.supplier_service_costs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.system_role = 'ADMINISTRADOR'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.system_role = 'ADMINISTRADOR'
        )
    );


-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_type ON public.stock_movements(created_at, movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_origin_dest ON public.stock_movements(origin_location_id, destination_location_id);
CREATE INDEX IF NOT EXISTS idx_loads_dates_status ON public.loads(expected_arrival_date, status);
CREATE INDEX IF NOT EXISTS idx_loads_created_at ON public.loads(created_at);
CREATE INDEX IF NOT EXISTS idx_losses_created_work ON public.losses(created_at, work_id);
CREATE INDEX IF NOT EXISTS idx_divergences_created_status ON public.divergences(created_at, status);
CREATE INDEX IF NOT EXISTS idx_demob_pallets_origin_status ON public.demobilization_pallets(origin_location_id, status);
