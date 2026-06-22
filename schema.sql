--
-- PostgreSQL database dump
--

\restrict nJaSXticm6Qvfl001Qc5rRBfwNccHXW5xEWzl1RhByQqWO2oScUej5Nlh2ZPmK5

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id text NOT NULL,
    phone text NOT NULL,
    direction text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    media_url text,
    CONSTRAINT chat_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text]))),
    CONSTRAINT chat_messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'file'::text, 'status'::text, 'image'::text])))
);


--
-- Name: config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config (
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id text NOT NULL,
    name text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    unit text DEFAULT 'unidad'::text NOT NULL,
    stock numeric DEFAULT 0 NOT NULL,
    min_stock numeric DEFAULT 0 NOT NULL,
    cost_per_unit numeric DEFAULT 0 NOT NULL,
    supplier text DEFAULT ''::text NOT NULL,
    last_restocked date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    client_name text NOT NULL,
    client_phone text NOT NULL,
    delivery_type text DEFAULT 'delivery'::text NOT NULL,
    address text DEFAULT ''::text,
    payment_method text DEFAULT 'efectivo'::text NOT NULL,
    payment_status text DEFAULT 'na'::text NOT NULL,
    receipt_url text,
    cash_amount numeric,
    change_amount numeric,
    status text DEFAULT 'recibido'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    modification_fee numeric DEFAULT 0,
    original_total numeric,
    modification_notes text,
    discount numeric
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text,
    available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    protein_options jsonb,
    wrapper_options jsonb,
    allow_custom_build boolean DEFAULT false
);


--
-- Name: quick_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id text NOT NULL,
    item_id text NOT NULL,
    type text NOT NULL,
    quantity numeric NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'salida'::text, 'ajuste'::text])))
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method text DEFAULT 'efectivo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transactions_payment_method_check CHECK ((payment_method = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text]))),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['ingreso'::text, 'egreso'::text])))
);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (key);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quick_replies quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT quick_replies_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_messages_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_order_id ON public.chat_messages USING btree (order_id);


--
-- Name: idx_chat_messages_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_phone ON public.chat_messages USING btree (phone);


--
-- Name: idx_chat_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_unread ON public.chat_messages USING btree (order_id, direction, read) WHERE ((direction = 'incoming'::text) AND (read = false));


--
-- Name: stock_movements stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: quick_replies Allow all for quick_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for quick_replies" ON public.quick_replies USING (true) WITH CHECK (true);


--
-- Name: chat_messages Allow all operations on chat_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on chat_messages" ON public.chat_messages USING (true) WITH CHECK (true);


--
-- Name: orders Allow public delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete" ON public.orders FOR DELETE USING (true);


--
-- Name: categories Allow public delete categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete categories" ON public.categories FOR DELETE USING (true);


--
-- Name: config Allow public delete config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete config" ON public.config FOR DELETE USING (true);


--
-- Name: inventory Allow public delete inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete inventory" ON public.inventory FOR DELETE USING (true);


--
-- Name: products Allow public delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete products" ON public.products FOR DELETE USING (true);


--
-- Name: stock_movements Allow public delete stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete stock_movements" ON public.stock_movements FOR DELETE USING (true);


--
-- Name: transactions Allow public delete transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete transactions" ON public.transactions FOR DELETE USING (true);


--
-- Name: orders Allow public insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert" ON public.orders FOR INSERT WITH CHECK (true);


--
-- Name: categories Allow public insert categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert categories" ON public.categories FOR INSERT WITH CHECK (true);


--
-- Name: config Allow public insert config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert config" ON public.config FOR INSERT WITH CHECK (true);


--
-- Name: inventory Allow public insert inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert inventory" ON public.inventory FOR INSERT WITH CHECK (true);


--
-- Name: products Allow public insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert products" ON public.products FOR INSERT WITH CHECK (true);


--
-- Name: stock_movements Allow public insert stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert stock_movements" ON public.stock_movements FOR INSERT WITH CHECK (true);


--
-- Name: transactions Allow public insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);


--
-- Name: orders Allow public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read" ON public.orders FOR SELECT USING (true);


--
-- Name: categories Allow public read categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);


--
-- Name: config Allow public read config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read config" ON public.config FOR SELECT USING (true);


--
-- Name: inventory Allow public read inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read inventory" ON public.inventory FOR SELECT USING (true);


--
-- Name: products Allow public read products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);


--
-- Name: stock_movements Allow public read stock_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read stock_movements" ON public.stock_movements FOR SELECT USING (true);


--
-- Name: transactions Allow public read transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);


--
-- Name: orders Allow public update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update" ON public.orders FOR UPDATE USING (true);


--
-- Name: categories Allow public update categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update categories" ON public.categories FOR UPDATE USING (true);


--
-- Name: config Allow public update config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update config" ON public.config FOR UPDATE USING (true);


--
-- Name: inventory Allow public update inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update inventory" ON public.inventory FOR UPDATE USING (true);


--
-- Name: products Allow public update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update products" ON public.products FOR UPDATE USING (true);


--
-- Name: transactions Allow public update transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update transactions" ON public.transactions FOR UPDATE USING (true);


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict nJaSXticm6Qvfl001Qc5rRBfwNccHXW5xEWzl1RhByQqWO2oScUej5Nlh2ZPmK5

