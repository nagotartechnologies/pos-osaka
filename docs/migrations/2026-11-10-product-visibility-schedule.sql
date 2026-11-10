-- ============================================================================
-- Horario de disponibilidad de productos (promos por franja) — POS Osaka
-- Fecha: 2026-11-10
--
-- Un producto con horario solo aparece en la carta y el POS dentro de su
-- franja (ej. todos los días 13:00–14:00) y no se puede pedir fuera de ella.
--   visible_days        smallint[] (0=dom..6=sáb). NULL = todos los días.
--   visible_time_start  "HH:mm"
--   visible_time_end    "HH:mm" (si es menor que start, cruza medianoche)
-- Todo NULL = siempre disponible (comportamiento actual). No borra datos.
--
-- Aplicar ANTES de desplegar la app que guarda estas columnas.
-- ============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS visible_days smallint[],
    ADD COLUMN IF NOT EXISTS visible_time_start text,
    ADD COLUMN IF NOT EXISTS visible_time_end text;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_visible_days_range;
ALTER TABLE public.products ADD CONSTRAINT products_visible_days_range
    CHECK (visible_days IS NULL OR visible_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_visible_time_format;
ALTER TABLE public.products ADD CONSTRAINT products_visible_time_format CHECK (
    (visible_time_start IS NULL OR visible_time_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND
    (visible_time_end   IS NULL OR visible_time_end   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));

-- Que PostgREST vea las columnas nuevas sin reiniciar
NOTIFY pgrst, 'reload schema';
