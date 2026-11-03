-- Privilegios para los roles de Supabase sobre el schema public
-- anon (key pública) solo lee el menú; el resto lo restringen las RLS de
-- docs/migrations/2026-11-02-security-rls.sql (ejecutarla después de este archivo).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON public.products, public.categories TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO authenticated, service_role;

-- ── Realtime ────────────────────────────────────────────────────
-- Recrea la publicacion supabase_realtime con las tablas de la app.
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.orders,
  public.chat_messages,
  public.inventory,
  public.products,
  public.categories,
  public.config,
  public.quick_replies,
  public.stock_movements,
  public.transactions;

-- REPLICA IDENTITY FULL: envia el registro completo en UPDATE/DELETE
ALTER TABLE public.orders          REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages   REPLICA IDENTITY FULL;
ALTER TABLE public.inventory       REPLICA IDENTITY FULL;
ALTER TABLE public.products        REPLICA IDENTITY FULL;
ALTER TABLE public.categories      REPLICA IDENTITY FULL;
ALTER TABLE public.config          REPLICA IDENTITY FULL;
ALTER TABLE public.quick_replies   REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.transactions    REPLICA IDENTITY FULL;
