-- ============================================================
-- POS Osaka — Schema SQL completo (exportado desde Supabase)
-- Fecha: 2026-03-19
-- ============================================================

-- ── 1. Tabla: categories ────────────────────────────────────
CREATE TABLE public.categories (
  id text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- ── 2. Tabla: products ──────────────────────────────────────
CREATE TABLE public.products (
  id text NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  image text NOT NULL DEFAULT ''::text,
  category text NOT NULL DEFAULT ''::text,
  description text DEFAULT ''::text,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  protein_options jsonb,
  wrapper_options jsonb,
  allow_custom_build boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- ── 3. Tabla: orders ────────────────────────────────────────
CREATE TABLE public.orders (
  id text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  delivery_type text NOT NULL DEFAULT 'delivery'::text,
  address text DEFAULT ''::text,
  payment_method text NOT NULL DEFAULT 'efectivo'::text,
  payment_status text NOT NULL DEFAULT 'na'::text,
  receipt_url text,
  cash_amount numeric,
  change_amount numeric,
  status text NOT NULL DEFAULT 'recibido'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  modification_fee numeric DEFAULT 0,
  original_total numeric,
  modification_notes text,
  discount numeric,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

-- ── 4. Tabla: chat_messages ─────────────────────────────────
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  phone text NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])),
  message text NOT NULL,
  type text NOT NULL DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'file'::text, 'status'::text, 'image'::text])),
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  media_url text,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

-- ── 5. Tabla: inventory ─────────────────────────────────────
CREATE TABLE public.inventory (
  id text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT ''::text,
  unit text NOT NULL DEFAULT 'unidad'::text,
  stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  supplier text NOT NULL DEFAULT ''::text,
  last_restocked date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);

-- ── 6. Tabla: stock_movements ───────────────────────────────
CREATE TABLE public.stock_movements (
  id text NOT NULL,
  item_id text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['entrada'::text, 'salida'::text, 'ajuste'::text])),
  quantity numeric NOT NULL,
  note text DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id)
);

-- ── 7. Tabla: transactions ──────────────────────────────────
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['ingreso'::text, 'egreso'::text])),
  category text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'efectivo'::text CHECK (payment_method = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

-- ── 8. Tabla: config ────────────────────────────────────────
CREATE TABLE public.config (
  key text NOT NULL,
  value text NOT NULL DEFAULT ''::text,
  CONSTRAINT config_pkey PRIMARY KEY (key)
);

-- ── 9. Tabla: quick_replies ─────────────────────────────────
CREATE TABLE public.quick_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quick_replies_pkey PRIMARY KEY (id)
);

-- ── 10. Realtime ────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;

-- ── 11. RLS + Políticas permisivas ──────────────────────────
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON categories      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON products        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON orders          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_messages   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON inventory       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON transactions    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON config          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON quick_replies   FOR ALL USING (true) WITH CHECK (true);

-- ── 12. Storage bucket ──────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('productos', 'productos', true)
-- ON CONFLICT (id) DO NOTHING;
