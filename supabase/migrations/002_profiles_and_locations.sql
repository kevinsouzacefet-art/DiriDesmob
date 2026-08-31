-- ============================================================================
-- 002_PROFILES_AND_LOCATIONS.SQL
-- DiriDesmob Foundation - Profiles, Locations, Works, Suppliers and Access
-- ============================================================================

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    system_role user_system_role NOT NULL DEFAULT 'OBRA_CONFERENTE',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto trigger for profiles updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. LOCATIONS (Base polymorphic entity: Galpão, Obra, Fornecedor)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type location_type NOT NULL,
    address TEXT,
    city TEXT,
    state VARCHAR(2),
    postal_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_locations_updated_at ON public.locations;
CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. WORKS (Specialization for Obra)
CREATE TABLE IF NOT EXISTS public.works (
    id UUID PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
    status work_status NOT NULL DEFAULT 'EM_ANDAMENTO',
    start_date DATE,
    end_date DATE,
    manager_name TEXT,
    contract_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_works_updated_at ON public.works;
CREATE TRIGGER trg_works_updated_at
BEFORE UPDATE ON public.works
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. SUPPLIERS (Specialization for Fornecedor)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
    cnpj TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. USER LOCATION ACCESS (Access Control Matrix)
CREATE TABLE IF NOT EXISTS public.user_location_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_location UNIQUE (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_loc_user ON public.user_location_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_loc_location ON public.user_location_access(location_id);
