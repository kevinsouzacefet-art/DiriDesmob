-- ============================================================================
-- 008_FIX_LOSS_VALUATION_RATES.SQL
-- DiriDesmob Corrective Migration - Precise Financial Loss & Supplier Rates Model
-- ============================================================================

-- 1. DROP EXISTING INTERMEDIATE IMPLEMENTATION FROM MIGRATION 007
DROP FUNCTION IF EXISTS public.fn_get_loss_rate_for_date(DATE);
DROP TABLE IF EXISTS public.loss_valuation_rates CASCADE;

-- 2. RECREATE LOSS VALUATION RATES WITH MATERIAL & WORK SPECIFICITY
-- Financial indemnification rates per m² per material (with optional work-specific override)
CREATE TABLE public.loss_valuation_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    work_id UUID REFERENCES public.works(id) ON DELETE RESTRICT,
    rate_per_m2 NUMERIC(12, 4) NOT NULL CHECK (rate_per_m2 >= 0),
    valid_from DATE NOT NULL,
    valid_to DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_loss_rate_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Trigger for updated_at
CREATE TRIGGER trg_loss_valuation_rates_updated_at
BEFORE UPDATE ON public.loss_valuation_rates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for performance
CREATE INDEX idx_loss_rates_lookup ON public.loss_valuation_rates(material_id, work_id, valid_from, valid_to);
CREATE INDEX idx_loss_rates_material ON public.loss_valuation_rates(material_id);
CREATE INDEX idx_loss_rates_work ON public.loss_valuation_rates(work_id);

-- 3. STRICT RLS POLICIES FOR LOSS VALUATION RATES
-- NO "USING (TRUE)" ALLOWED. Only ADMINISTRADOR and ANALISTA can read. Only ADMINISTRADOR can manage.
ALTER TABLE public.loss_valuation_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_loss_rates_sel" ON public.loss_valuation_rates
FOR SELECT TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA'));

CREATE POLICY "p_loss_rates_ins" ON public.loss_valuation_rates
FOR INSERT TO authenticated
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

CREATE POLICY "p_loss_rates_upd" ON public.loss_valuation_rates
FOR UPDATE TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- Note: Physical DELETE is intentionally not permitted to preserve historical financial integrity.

-- 4. FUNCTION TO RETRIEVE ACTIVE LOSS RATE FOR A MATERIAL AND WORK
-- Rule:
-- 1. Try specific (material_id + work_id) for the target date
-- 2. Fallback to default (material_id + work_id IS NULL) for the target date
-- 3. Return NULL if neither exists (caller should block loss creation)
CREATE OR REPLACE FUNCTION fn_get_loss_rate_for_material_and_work(
    p_material_id UUID,
    p_work_id UUID DEFAULT NULL,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    -- 1. Specific work override check
    IF p_work_id IS NOT NULL THEN
        SELECT rate_per_m2 INTO v_rate
        FROM public.loss_valuation_rates
        WHERE material_id = p_material_id
          AND work_id = p_work_id
          AND valid_from <= p_date
          AND (valid_to IS NULL OR valid_to >= p_date)
        ORDER BY valid_from DESC, created_at DESC
        LIMIT 1;
        
        IF v_rate IS NOT NULL THEN
            RETURN v_rate;
        END IF;
    END IF;

    -- 2. Default material rate check (work_id IS NULL)
    SELECT rate_per_m2 INTO v_rate
    FROM public.loss_valuation_rates
    WHERE material_id = p_material_id
      AND work_id IS NULL
      AND valid_from <= p_date
      AND (valid_to IS NULL OR valid_to >= p_date)
    ORDER BY valid_from DESC, created_at DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
        RETURN v_rate;
    END IF;

    -- 3. No rate registered
    RETURN NULL;
END;
$$;

-- 5. SUPPLIER SERVICE RATES (CONFIRMING STRICT ARCHITECTURAL SEPARATION)
-- Represents supplier remuneration per m² for maintenance/handling services
CREATE TABLE IF NOT EXISTS public.supplier_service_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    rate_per_m2 NUMERIC(12, 4) NOT NULL CHECK (rate_per_m2 >= 0),
    valid_from DATE NOT NULL,
    valid_to DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_supplier_service_rate_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

DROP TRIGGER IF EXISTS trg_supplier_service_rates_updated_at ON public.supplier_service_rates;
CREATE TRIGGER trg_supplier_service_rates_updated_at
BEFORE UPDATE ON public.supplier_service_rates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_supplier_service_rates_lookup ON public.supplier_service_rates(supplier_id, valid_from, valid_to);

ALTER TABLE public.supplier_service_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_supp_rates_sel" ON public.supplier_service_rates;
CREATE POLICY "p_supp_rates_sel" ON public.supplier_service_rates
FOR SELECT TO authenticated
USING (auth_user_role() IN ('ADMINISTRADOR', 'ANALISTA', 'FORNECEDOR_SUPERVISOR'));

DROP POLICY IF EXISTS "p_supp_rates_ins" ON public.supplier_service_rates;
CREATE POLICY "p_supp_rates_ins" ON public.supplier_service_rates
FOR INSERT TO authenticated
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

DROP POLICY IF EXISTS "p_supp_rates_upd" ON public.supplier_service_rates;
CREATE POLICY "p_supp_rates_upd" ON public.supplier_service_rates
FOR UPDATE TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');
