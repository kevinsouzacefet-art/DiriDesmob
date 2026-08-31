-- ============================================================================
-- 001_EXTENSIONS_AND_ENUMS.SQL
-- DiriDesmob Foundation - Schema Extensions and Core System Enums
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- System Roles
DO $$ BEGIN
    CREATE TYPE user_system_role AS ENUM (
        'ADMINISTRADOR',
        'ANALISTA',
        'OBRA_SUPERVISOR',
        'OBRA_CONFERENTE',
        'FORNECEDOR_SUPERVISOR',
        'FORNECEDOR_CONFERENTE',
        'GALPAO_CONFERENTE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Location Types
DO $$ BEGIN
    CREATE TYPE location_type AS ENUM (
        'GALPAO',
        'OBRA',
        'FORNECEDOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status Types
DO $$ BEGIN
    CREATE TYPE work_status AS ENUM (
        'PLANEJADA',
        'EM_ANDAMENTO',
        'DESMOBILIZACAO_INICIADA',
        'CONCLUIDA',
        'PARALISADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE load_status AS ENUM (
        'RASCUNHO',
        'PRONTA_PARA_ENVIO',
        'EM_TRANSITO',
        'ENTREGUE',
        'CONFERIDA',
        'CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pallet_status AS ENUM (
        'EM_MONTAGEM',
        'LIBERADO',
        'ALOCADO_EM_CARGA',
        'RECEBIDO',
        'DESMONTADO',
        'CANCELADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE conference_status AS ENUM (
        'EM_ANDAMENTO',
        'FINALIZADA',
        'CANCELADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE divergence_type AS ENUM (
        'FALTA',
        'SOBRA',
        'AVARIA',
        'ITEM_TROCADO',
        'OUTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE divergence_status AS ENUM (
        'ABERTA',
        'EM_ANALISE',
        'RESOLVIDA',
        'REJEITADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scrap_status AS ENUM (
        'AGUARDANDO_CLASSIFICACAO',
        'CLASSIFICADA',
        'DISPONIVEL_PARA_DESTINACAO',
        'DESTINADA',
        'DESCARTADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scrap_movement_status AS ENUM (
        'PENDENTE',
        'APROVADA',
        'REJEITADA',
        'EXECUTADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
