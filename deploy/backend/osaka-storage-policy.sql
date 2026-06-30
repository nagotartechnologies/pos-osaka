-- Permite a anon/authenticated operar sobre objetos del bucket 'media'.
-- (modelo de la app: sin auth real, anon hace todo; el bucket ya es publico para lectura)
DROP POLICY IF EXISTS "media anon all" ON storage.objects;
CREATE POLICY "media anon all" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');
