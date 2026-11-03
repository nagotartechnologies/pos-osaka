-- Bucket 'media' (público para lectura por URL).
-- Las policies vigentes viven en docs/migrations/2026-11-02-security-rls.sql:
--   * staff (JWT con app_role) gestiona todo el bucket
--   * anon solo puede subir a pos-osaka/comprobantes/
DROP POLICY IF EXISTS "media anon all" ON storage.objects;
