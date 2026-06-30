-- Reemplaza URLs de Cloudinary / proveedores externos por URLs de Supabase Storage.
-- Regla: nueva = PREFIX || (url sin esquema)
-- PREFIX apunta al bucket publico 'media' bajo el mismo dominio.

\set host_re '^https?://(res\\.cloudinary\\.com|mariscosdelaconcha\\.cl|tofuu\\.getjusto\\.com)/'
\set prefix 'https://osakasushi.nagotartech.com/storage/v1/object/public/media/'

BEGIN;

UPDATE public.products
   SET image = :'prefix' || regexp_replace(image, '^https?://', '')
 WHERE image ~ :'host_re';

UPDATE public.chat_messages
   SET media_url = :'prefix' || regexp_replace(media_url, '^https?://', '')
 WHERE media_url ~ :'host_re';

UPDATE public.orders
   SET receipt_url = :'prefix' || regexp_replace(receipt_url, '^https?://', '')
 WHERE receipt_url ~ :'host_re';

UPDATE public.config
   SET value = :'prefix' || regexp_replace(value, '^https?://', '')
 WHERE value ~ :'host_re';

COMMIT;

-- Verificacion
SELECT 'products'      AS tabla, count(*) AS migradas FROM public.products      WHERE image     LIKE '%/storage/v1/object/public/media/%'
UNION ALL
SELECT 'chat_messages', count(*) FROM public.chat_messages WHERE media_url  LIKE '%/storage/v1/object/public/media/%'
UNION ALL
SELECT 'orders',        count(*) FROM public.orders        WHERE receipt_url LIKE '%/storage/v1/object/public/media/%'
UNION ALL
SELECT 'config',        count(*) FROM public.config        WHERE value       LIKE '%/storage/v1/object/public/media/%';
