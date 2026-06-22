-- Tabla para almacenar mensajes de chat WhatsApp por pedido
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'file', 'status')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Columna para URLs de medios (imágenes, archivos)
-- Ejecutar si la tabla ya existe:
-- ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
-- ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
-- ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check CHECK (type IN ('text', 'file', 'status', 'image'));

-- Índices para búsqueda rápida
CREATE INDEX idx_chat_messages_order_id ON chat_messages(order_id);
CREATE INDEX idx_chat_messages_phone ON chat_messages(phone);
CREATE INDEX idx_chat_messages_unread ON chat_messages(order_id, direction, read) WHERE direction = 'incoming' AND read = false;

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- RLS (Row Level Security) - permitir todo con anon key
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on chat_messages"
  ON chat_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);
