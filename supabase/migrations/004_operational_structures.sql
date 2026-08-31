-- ============================================================================
-- 004_OPERATIONAL_STRUCTURES.SQL
-- DiriDesmob Foundation - Core Logistics, Pallets, Loads, Conferences & Stock
-- ============================================================================

-- 1. MOBILIZATIONS
CREATE TABLE IF NOT EXISTS public.mobilizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    destination_work_id UUID NOT NULL REFERENCES public.locations(id),
    origin_location_id UUID NOT NULL REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mobilization_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobilization_id UUID NOT NULL REFERENCES public.mobilizations(id) ON DELETE CASCADE,
    pallet_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mobilization_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobilization_pallet_id UUID NOT NULL REFERENCES public.mobilization_pallets(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. DEMOBILIZATION PALLETS
CREATE TABLE IF NOT EXISTS public.demobilization_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id),
    destination_location_id UUID REFERENCES public.locations(id),
    status pallet_status NOT NULL DEFAULT 'EM_MONTAGEM',
    created_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pallet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pallet_item UNIQUE (pallet_id, material_id)
);

-- 3. CARGAS (LOADS)
CREATE TABLE IF NOT EXISTS public.loads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    origin_location_id UUID NOT NULL REFERENCES public.locations(id),
    destination_location_id UUID NOT NULL REFERENCES public.locations(id),
    status load_status NOT NULL DEFAULT 'RASCUNHO',
    truck_plate TEXT,
    driver_name TEXT,
    driver_document TEXT,
    carrier_name TEXT,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.load_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_load_pallet UNIQUE (load_id, pallet_id)
);

-- 4. CONFERENCES
CREATE TABLE IF NOT EXISTS public.conferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id),
    status conference_status NOT NULL DEFAULT 'EM_ANDAMENTO',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    conferred_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conference_pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
    pallet_id UUID NOT NULL REFERENCES public.demobilization_pallets(id),
    is_conferred BOOLEAN NOT NULL DEFAULT FALSE,
    conferred_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conference_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_pallet_id UUID NOT NULL REFERENCES public.conference_pallets(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    expected_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    received_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DIVERGENCES & PHOTOS
CREATE TABLE IF NOT EXISTS public.divergences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id UUID REFERENCES public.conferences(id),
    load_id UUID NOT NULL REFERENCES public.loads(id),
    material_id UUID NOT NULL REFERENCES public.materials(id),
    type divergence_type NOT NULL,
    status divergence_status NOT NULL DEFAULT 'ABERTA',
    expected_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    difference_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_impact NUMERIC(12, 2) DEFAULT 0,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.divergence_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    divergence_id UUID NOT NULL REFERENCES public.divergences(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. LOSS MEETINGS
CREATE TABLE IF NOT EXISTS public.loss_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID NOT NULL REFERENCES public.locations(id),
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'AGENDADA',
    total_loss_value NUMERIC(14, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loss_meeting_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_meeting_id UUID NOT NULL REFERENCES public.loss_meetings(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loss_meeting_divergences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_meeting_id UUID NOT NULL REFERENCES public.loss_meetings(id) ON DELETE CASCADE,
    divergence_id UUID NOT NULL REFERENCES public.divergences(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SCRAP ITEMS
CREATE TABLE IF NOT EXISTS public.scrap_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.materials(id),
    current_location_id UUID NOT NULL REFERENCES public.locations(id),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    status scrap_status NOT NULL DEFAULT 'CLASSIFICADA',
    notes TEXT,
    classified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INVENTORY RESERVATIONS & IDEMPOTENCY
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.locations(id),
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    reserved_for_type TEXT NOT NULL,
    reserved_for_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operation_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_key TEXT NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'EXECUTED',
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
