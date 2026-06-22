-- Migración: Agregar opciones de proteína y envoltura a productos
-- Ejecutar en Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS protein_options JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wrapper_options JSONB DEFAULT NULL;

-- Ejemplo de uso:
-- UPDATE products SET protein_options = '[
--   {"name": "pollo", "price": 0},
--   {"name": "kanikama", "price": 0},
--   {"name": "salmon", "price": 1000},
--   {"name": "atun", "price": 1000},
--   {"name": "camaron", "price": 1500},
--   {"name": "jaiba", "price": 1500}
-- ]'::jsonb WHERE id = 'tu-product-id';
--
-- UPDATE products SET wrapper_options = '[
--   {"name": "queso crema", "price": 0},
--   {"name": "palta", "price": 1000},
--   {"name": "jamon", "price": 1000},
--   {"name": "ciboulette", "price": 1000},
--   {"name": "sesamo", "price": 1000},
--   {"name": "nori", "price": 1000},
--   {"name": "salmon", "price": 1000},
--   {"name": "fritos", "price": 1000}
-- ]'::jsonb WHERE id = 'tu-product-id';
