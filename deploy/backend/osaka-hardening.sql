-- Hardening pos-osaka (post-pentest 2026-11-03)
-- 1) Restringir uploads anonimos de comprobantes a imagenes/pdf con nombre plano
-- 2) Reducir privilegios de anon al minimo (RLS ya limita, pero GRANT ALL era excesivo)

BEGIN;

-- ── 1) Storage: comprobantes solo imagenes/pdf, sin subdirectorios ──────────
DROP POLICY IF EXISTS "media anon upload comprobantes" ON storage.objects;
CREATE POLICY "media anon upload comprobantes" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'media'
  AND name ~* '^pos-osaka/comprobantes/[A-Za-z0-9._-]+\.(jpe?g|png|webp|pdf)$'
);

-- ── 2) Grants: anon solo lo que necesita el browser publico ─────────────────
-- La carta usa: SELECT products/categories, EXECUTE is_staff, INSERT storage
-- (policy de arriba). Todo lo demas va por el service role del servidor.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT SELECT ON public.categories, public.products TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;

-- Evitar que tablas futuras hereden ALL para anon por defecto
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

COMMIT;
