-- Agregar campo allow_custom_build a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_custom_build BOOLEAN DEFAULT FALSE;

-- Agregar estado 'cotizado' a orders (ya es text libre, no requiere ALTER)
-- El campo status ya es text, solo necesitamos usarlo en la app.
