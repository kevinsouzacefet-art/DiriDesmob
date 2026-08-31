-- ============================================================================
-- 010_STORAGE_BUCKETS.SQL
-- DiriDesmob Phase 2.2 - Storage Bucket for Mobilization Excel Files
-- ============================================================================

-- Create private storage bucket for mobilization Excel files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mobilization-imports',
    'mobilization-imports',
    false,
    52428800, -- 50MB
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- Storage Policies for mobilization-imports
DROP POLICY IF EXISTS "p_storage_mob_imports_sel" ON storage.objects;
CREATE POLICY "p_storage_mob_imports_sel" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'mobilization-imports' AND (
        (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    )
);

DROP POLICY IF EXISTS "p_storage_mob_imports_ins" ON storage.objects;
CREATE POLICY "p_storage_mob_imports_ins" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'mobilization-imports' AND (
        (SELECT system_role FROM public.profiles WHERE id = auth.uid()) IN ('ADMINISTRADOR', 'ANALISTA')
    )
);
