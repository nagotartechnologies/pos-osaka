-- ============================================================================
-- Optimización de rendimiento + retención de datos — POS Osaka
-- Fecha: 2026-06-19
--
-- Cómo aplicar:
--   1) Abre Supabase → SQL Editor.
--   2) Copia/pega y ejecuta la FASE 1 (índices). Es seguro: NO borra datos.
--   3) (Opcional) Ejecuta la FASE 2 si quieres limpieza automática de datos
--      antiguos. Revisa qué bloques descomentar según lo que quieras purgar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- FASE 1 — ÍNDICES  (impacto alto en velocidad, riesgo nulo)
-- ----------------------------------------------------------------------------
-- Casi todas las consultas filtran/ordenan por created_at. Sin índice, Postgres
-- hace un Seq Scan + Sort de toda la tabla en cada consulta (lento y más egress).
-- Con estos índices, esas consultas pasan a ser index scans casi instantáneos.
--
-- NOTA: para tablas muy grandes en producción 24/7 puedes usar
-- "CREATE INDEX CONCURRENTLY ..." (evita bloquear la tabla), pero debe correrse
-- statement por statement, fuera de una transacción. Para tablas pequeñas el
-- CREATE INDEX normal tarda milisegundos.

-- orders: la tabla más consultada (cache, dashboard, cierre de caja, ventas).
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- orders: filtros por estado (countOrdersByStatus, clearDelivered).
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

-- orders: acelera el dedupe anti-duplicado (client_phone + ventana de tiempo)
-- y la búsqueda de historial por cliente (getClientContext).
CREATE INDEX IF NOT EXISTS idx_orders_phone_created
  ON public.orders (client_phone, created_at DESC);

-- transactions: el listado de finanzas ordena por date.
CREATE INDEX IF NOT EXISTS idx_transactions_date
  ON public.transactions (date DESC);

-- stock_movements: el historial de inventario ordena por created_at.
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at
  ON public.stock_movements (created_at DESC);


-- ----------------------------------------------------------------------------
-- FASE 2 — RETENCIÓN  (limpieza de datos antiguos)
-- ----------------------------------------------------------------------------
-- Recomendación: purgar SOLO los chats antiguos (no aportan a reportes ni
-- contabilidad y son lo que más crece). Los pedidos y transacciones se
-- CONSERVAN: con los índices de la Fase 1 no ralentizan la app, y mantienen el
-- historial de negocio/contabilidad.
--
-- Las purgas más agresivas quedan COMENTADAS más abajo por si en el futuro
-- quieres acotar el almacenamiento.

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Chats de más de 30 días.
  -- En la app, los chats de pedidos entregados/cancelados ya se borran al
  -- cerrar el pedido; esto barre los huérfanos (pedidos nunca cerrados,
  -- números sin pedido) y cualquier mensaje viejo olvidado.
  DELETE FROM public.chat_messages
  WHERE created_at < now() - interval '30 days';

  -- ── OPCIONALES (descomenta lo que quieras activar) ──────────────────────

  -- Movimientos de stock de más de 12 meses (no afecta el stock actual,
  -- solo el historial de entradas/salidas).
  -- DELETE FROM public.stock_movements
  -- WHERE created_at < now() - interval '12 months';

  -- Pedidos de más de 2 años (conservador). Afecta historial de clientes
  -- y reportes muy antiguos. El dashboard solo usa hasta 90 días.
  -- DELETE FROM public.orders
  -- WHERE created_at < now() - interval '2 years';

  -- Transacciones de más de 5 años (contabilidad). Por defecto NO se purgan.
  -- DELETE FROM public.transactions
  -- WHERE date < (CURRENT_DATE - interval '5 years');
END;
$$;

-- Ejecución manual (puedes correr esto cuando quieras para limpiar ya):
--   SELECT public.cleanup_old_data();

-- ----------------------------------------------------------------------------
-- Programar la limpieza automática con pg_cron (recomendado)
-- ----------------------------------------------------------------------------
-- Requiere habilitar la extensión pg_cron una sola vez:
--   Supabase → Database → Extensions → habilitar "pg_cron".
-- Luego programa el job para que corra todos los días a las 04:00:
--
--   SELECT cron.schedule(
--     'cleanup-old-data',
--     '0 4 * * *',
--     $$ SELECT public.cleanup_old_data(); $$
--   );
--
-- Para ver los jobs programados:   SELECT * FROM cron.job;
-- Para eliminar el job:            SELECT cron.unschedule('cleanup-old-data');
