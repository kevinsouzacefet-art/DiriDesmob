-- ============================================================================
-- 007_ARCHITECTURE_ALIGNMENT_AND_LOSS_RATES.SQL
-- DiriDesmob Corrective Migration - Stripping Extra Columns & Adding Loss Rates
-- ============================================================================

-- 1. CLEANUP MATERIALS TABLE (Strict alignment with approved schema)
-- Approved columns ONLY: id, code, name, width_mm, height_mm, unit_area_m2, unit, is_active, created_at, updated_at
ALTER TABLE public.materials 
    DROP COLUMN IF EXISTS weight_kg,
    DROP COLUMN IF EXISTS daily_rental_rate,
    DROP COLUMN IF EXISTS replacement_cost,
    DROP COLUMN IF EXISTS description;

-- 2. CLEANUP WORKS TABLE (Strict alignment with locations + works architecture)
-- Approved columns ONLY: id (PK FK locations), status, manager_name, notes, created_at, updated_at
ALTER TABLE public.works 
    DROP COLUMN IF EXISTS contract_number,
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS end_date;

-- 3. CREATE LOSS VALUATION RATES TABLE (Historical m² rates for financial loss calculation)
CREATE TABLE IF NOT EXISTS public.loss_valuation_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_per_m2 NUMERIC(12, 4) NOT NULL CHECK (rate_per_m2 > 0),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_loss_rate_dates CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

DROP TRIGGER IF EXISTS trg_loss_valuation_rates_updated_at ON public.loss_valuation_rates;
CREATE TRIGGER trg_loss_valuation_rates_updated_at
BEFORE UPDATE ON public.loss_valuation_rates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_loss_rates_validity ON public.loss_valuation_rates(valid_from, valid_until);

-- 4. RLS POLICIES FOR LOSS VALUATION RATES
ALTER TABLE public.loss_valuation_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_loss_rates_sel" ON public.loss_valuation_rates FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "p_loss_rates_adm" ON public.loss_valuation_rates FOR ALL TO authenticated
USING (auth_user_role() = 'ADMINISTRADOR')
WITH CHECK (auth_user_role() = 'ADMINISTRADOR');

-- 5. FUNCTION TO RETRIEVE ACTIVE LOSS RATE FOR A GIVEN DATE
CREATE OR REPLACE FUNCTION fn_get_loss_rate_for_date(p_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
    SELECT rate_per_m2 
    FROM public.loss_valuation_rates 
    WHERE valid_from <= p_date 
      AND (valid_until IS NULL OR valid_until >= p_date)
    ORDER BY valid_from DESC, created_at DESC
    LIMIT 1;
$$;
