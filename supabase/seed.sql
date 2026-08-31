-- ============================================================================
-- SEED.SQL
-- DiriDesmob Development Seed Data (Locations, Works, Suppliers, Materials)
-- ============================================================================

-- 1. Locations: Galpão Central
INSERT INTO public.locations (id, code, name, type, address, city, state, postal_code, is_active)
VALUES 
    ('a1111111-1111-1111-1111-111111111111', 'GALP-CENTRAL', 'Galpão Central de Distribuição SP', 'GALPAO', 'Av. Industrial, 1500 - Distrito Industrial', 'Barueri', 'SP', '06455-000', true)
ON CONFLICT (code) DO NOTHING;

-- 2. Locations & Works: 2 Obras
INSERT INTO public.locations (id, code, name, type, address, city, state, postal_code, is_active)
VALUES 
    ('b2222222-2222-2222-2222-222222222221', 'OBRA-RES-PARK', 'Residencial Park Towers', 'OBRA', 'Rua das Palmeiras, 300 - Bela Vista', 'São Paulo', 'SP', '01310-200', true),
    ('b2222222-2222-2222-2222-222222222222', 'OBRA-CORP-HORIZON', 'Complexo Corporativo Horizon', 'OBRA', 'Av. das Nações Unidas, 12000 - Brooklin', 'São Paulo', 'SP', '04795-100', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.works (id, status, manager_name, notes)
VALUES
    ('b2222222-2222-2222-2222-222222222221', 'EM_ANDAMENTO', 'Eng. Marcos Silveira', 'Fase de desforma dos blocos A e B'),
    ('b2222222-2222-2222-2222-222222222222', 'EM_ANDAMENTO', 'Enga. Camila Duarte', 'Concretagem do 14º pavimento tipo')
ON CONFLICT (id) DO NOTHING;

-- 3. Locations & Suppliers: 2 Fornecedores
INSERT INTO public.locations (id, code, name, type, address, city, state, postal_code, is_active)
VALUES 
    ('c3333333-3333-3333-3333-333333333331', 'FORN-FORMAX', 'Formax Soluções em Fôrmas Metálicas', 'FORNECEDOR', 'Rodovia dos Bandeirantes, km 42', 'Cajamar', 'SP', '07750-000', true),
    ('c3333333-3333-3333-3333-333333333332', 'FORN-ALUFORM', 'Aluform Sistemas de Alumínio e Escoramento', 'FORNECEDOR', 'Av. das Indústrias, 850', 'Betim', 'MG', '32600-000', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.suppliers (id, cnpj, contact_name, contact_phone, contact_email, is_active)
VALUES
    ('c3333333-3333-3333-3333-333333333331', '12.345.678/0001-90', 'Roberto Vianna', '(11) 98765-4321', 'roberto.vianna@formax.com.br', true),
    ('c3333333-3333-3333-3333-333333333332', '98.765.432/0001-10', 'Helena Ramos', '(31) 99123-4567', 'h.ramos@aluform.ind.br', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Materials: Catálogo Padrão de Painéis e Perfis (Strict columns ONLY)
INSERT INTO public.materials (id, code, name, width_mm, height_mm, unit, is_active)
VALUES
    ('d4444444-4444-4444-4444-444444444441', 'PAN-2400-600', 'Painel Fôrma Metálica 2400x600', 600.00, 2400.00, 'UN', true),
    ('d4444444-4444-4444-4444-444444444442', 'PAN-2400-450', 'Painel Fôrma Metálica 2400x450', 450.00, 2400.00, 'UN', true),
    ('d4444444-4444-4444-4444-444444444443', 'PAN-2400-300', 'Painel Fôrma Metálica 2400x300', 300.00, 2400.00, 'UN', true),
    ('d4444444-4444-4444-4444-444444444444', 'PAN-1200-600', 'Painel Fôrma Metálica 1200x600', 600.00, 1200.00, 'UN', true),
    ('d4444444-4444-4444-4444-444444444445', 'VIG-ALU-2400', 'Viga de Alumínio Primária 2400mm', 150.00, 2400.00, 'UN', true),
    ('d4444444-4444-4444-4444-444444444446', 'ESC-MET-3500', 'Escora Telescópica Pesada 3.50m', 120.00, 3500.00, 'UN', true)
ON CONFLICT (code) DO NOTHING;

-- 5. Loss Valuation Rates (Taxas de indenização de perda por m² por material com override opcional de obra)
INSERT INTO public.loss_valuation_rates (id, material_id, work_id, rate_per_m2, valid_from, valid_to, notes)
VALUES
    -- Taxa padrão de PAN-2400-600
    ('e5555555-5555-5555-5555-555555555551', 'd4444444-4444-4444-4444-444444444441', NULL, 250.0000, '2025-01-01', NULL, 'Taxa padrão contratual'),
    -- Taxa específica de PAN-2400-600 para a obra Residencial Park Towers
    ('e5555555-5555-5555-5555-555555555552', 'd4444444-4444-4444-4444-444444444441', 'b2222222-2222-2222-2222-222222222221', 280.0000, '2025-01-01', NULL, 'Aditivo contratual específico Obra Park Towers'),
    -- Taxa padrão de PAN-2400-450
    ('e5555555-5555-5555-5555-555555555553', 'd4444444-4444-4444-4444-444444444442', NULL, 240.0000, '2025-01-01', NULL, 'Taxa padrão contratual')
ON CONFLICT (id) DO NOTHING;

-- 6. Supplier Service Rates (Remuneração de serviços de fornecedor por m²)
INSERT INTO public.supplier_service_rates (id, supplier_id, rate_per_m2, valid_from, valid_to, notes)
VALUES
    ('f6666666-6666-6666-6666-666666666661', 'c3333333-3333-3333-3333-333333333331', 35.0000, '2025-01-01', NULL, 'Tabela de prestação de serviço Formax 2025/2026'),
    ('f6666666-6666-6666-6666-666666666662', 'c3333333-3333-3333-3333-333333333332', 38.5000, '2025-01-01', NULL, 'Tabela de prestação de serviço Aluform 2025/2026')
ON CONFLICT (id) DO NOTHING;

