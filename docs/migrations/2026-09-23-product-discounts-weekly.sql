-- ============================================================================
-- Descuentos semanales recurrentes en productos — POS Osaka
-- Fecha: 2026-09-23
--
-- Cómo aplicar:
--   1) Abre Supabase → SQL Editor.
--   2) Copia/pega y ejecuta el bloque. Es seguro: NO borra datos.
--   3) Añade 3 columnas a public.products para manejar descuentos
--      semanales recurrentes: días de la semana (array smallint 0=dom..6=sáb),
--      horario diario opcional (texto "HH:mm"). El modo "fecha única" existente
--      (discount_start/discount_end) se mantiene; cuando discount_days es un
--      array no vacío, el descuento se interpreta como semanal (la app resuelve
--      la vigencia). El horario cruza medianoche si time_end < time_start.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Columnas de descuento semanal
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS discount_days smallint[],
    ADD COLUMN IF NOT EXISTS discount_time_start text,
    ADD COLUMN IF NOT EXISTS discount_time_end text;

-- Restricción: los días deben ser un subconjunto de [0..6] o NULL.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_days_range;
ALTER TABLE public.products ADD CONSTRAINT products_discount_days_range
    CHECK (discount_days IS NULL OR discount_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

-- Restricción: los horarios, si existen, deben tener formato "HH:mm" (00:00–23:59).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_time_format;
ALTER TABLE public.products ADD CONSTRAINT products_discount_time_format CHECK (
    (discount_time_start IS NULL OR discount_time_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND
    (discount_time_end   IS NULL OR discount_time_end   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
