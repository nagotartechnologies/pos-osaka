-- ════════════════════════════════════════════════════════════════
-- Cierre de la base: la anon key (pública en el bundle) ya no puede leer
-- pedidos, chats, finanzas ni config. Solo el staff logueado (JWT emitido
-- por /api/auth/* con app_role admin|vendedor) y el servidor (service_role).
--
-- EJECUTAR DESPUÉS de desplegar la app nueva y cargar las env vars
-- SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET y SESSION_SECRET.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- Staff = JWT con app_role válido (no basta role=authenticated, por si GoTrue
-- tuviera el signup habilitado).
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'app_role', '') IN ('admin', 'vendedor')
$$;

-- 1. Borrar TODAS las policies existentes del schema public (las "USING (true)")
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. Privilegios: anon sin acceso salvo lo explícito
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

GRANT SELECT ON public.products, public.categories TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 3. RLS activado en todas las tablas
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;

-- 4. Carta pública: solo leer el menú
CREATE POLICY "public read products"   ON public.products   FOR SELECT TO anon USING (true);
CREATE POLICY "public read categories" ON public.categories FOR SELECT TO anon USING (true);

-- 5. Staff: acceso completo a las tablas operativas
CREATE POLICY "staff all categories"      ON public.categories      FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all chat_messages"   ON public.chat_messages   FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all inventory"       ON public.inventory       FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all orders"          ON public.orders          FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all products"        ON public.products        FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all quick_replies"   ON public.quick_replies   FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all stock_movements" ON public.stock_movements FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff all transactions"    ON public.transactions    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 6. Config: el staff lee/escribe todo MENOS los PINs (pin*), que solo toca el servidor
CREATE POLICY "staff all config" ON public.config FOR ALL TO authenticated
  USING (public.is_staff() AND key NOT LIKE 'pin%')
  WITH CHECK (public.is_staff() AND key NOT LIKE 'pin%');

-- 7. Storage (bucket público 'media'): lectura por URL pública sigue funcionando.
--    anon solo puede SUBIR comprobantes; el staff gestiona todo el bucket.
DROP POLICY IF EXISTS "media anon all" ON storage.objects;
DROP POLICY IF EXISTS "media staff all" ON storage.objects;
DROP POLICY IF EXISTS "media anon upload comprobantes" ON storage.objects;
CREATE POLICY "media staff all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'media' AND public.is_staff())
  WITH CHECK (bucket_id = 'media' AND public.is_staff());
CREATE POLICY "media anon upload comprobantes" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'media' AND name LIKE 'pos-osaka/comprobantes/%');

COMMIT;

-- Verificación rápida (debe devolver 0 filas con la anon key):
--   curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$URL/rest/v1/orders?select=id&limit=1"
--   curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$URL/rest/v1/config?key=eq.pinAdmin"
