-- ============================================================================
-- Descuentos por tiempo limitado en productos — POS Osaka
-- Fecha: 2026-09-23
--
-- Cómo aplicar:
--   1) Abre Supabase → SQL Editor.
--   2) Copia/pega y ejecuta el bloque. Es seguro: NO borra datos.
--   3) Añade 3 columnas a public.products para manejar descuentos en
--      porcentaje con vigencia (fecha/hora de inicio y fin). El descuento
--      se activa/desactiva solo según las fechas (lo resuelve la app).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Columnas de descuento
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS discount_pct numeric,
    ADD COLUMN IF NOT EXISTS discount_start timestamptz,
    ADD COLUMN IF NOT EXISTS discount_end timestamptz;

-- Restricción: el porcentaje debe estar en (0, 100) o ser NULL (sin descuento).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_pct_range;
ALTER TABLE public.products ADD CONSTRAINT products_discount_pct_range
    CHECK (discount_pct IS NULL OR (discount_pct > 0 AND discount_pct < 100));
