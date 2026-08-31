-- ============================================================================
-- 003_MATERIALS.SQL
-- DiriDesmob Foundation - Materials Catalogue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    width_mm NUMERIC(10, 2) NOT NULL CHECK (width_mm > 0),
    height_mm NUMERIC(10, 2) NOT NULL CHECK (height_mm > 0),
    unit_area_m2 NUMERIC(12, 4) GENERATED ALWAYS AS ((width_mm / 1000.0) * (height_mm / 1000.0)) STORED,
    unit TEXT NOT NULL DEFAULT 'UN',
    weight_kg NUMERIC(10, 2) DEFAULT 0,
    daily_rental_rate NUMERIC(12, 4) DEFAULT 0,
    replacement_cost NUMERIC(12, 2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_materials_updated_at ON public.materials;
CREATE TRIGGER trg_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_materials_code ON public.materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(is_active);
