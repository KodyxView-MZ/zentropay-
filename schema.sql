-- ZentroPay Supabase Database Schema
-- SQL script to recreate all required tables and relationships

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USUARIOS (Sincronizado com Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'banned')),
    faturamento NUMERIC(12, 2) DEFAULT 0.00,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own profile
CREATE POLICY "Users can read own profile" ON public.usuarios 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.usuarios 
    FOR UPDATE USING (auth.uid() = id);

-- Allow public inserts for registration
CREATE POLICY "Public profiles insert" ON public.usuarios 
    FOR INSERT WITH CHECK (true);


-- ============================================================
-- 2. PRODUTOS (Infoprodutos criados pelos vendedores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    serial TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    descricao_curta TEXT,
    descricao_longa TEXT,
    categoria TEXT,
    contacto_vendedor TEXT,
    imagem TEXT, -- Armazena dados base64 da imagem
    banner TEXT, -- Armazena dados base64 do banner
    urgent_enabled BOOLEAN DEFAULT false,
    urgent_minutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'banned')),
    visualizacoes INTEGER DEFAULT 0,
    cliques INTEGER DEFAULT 0,
    vendas INTEGER DEFAULT 0,
    link_produto TEXT,
    metodos_pagamento TEXT[] DEFAULT '{}'::text[],
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Policies for produtos
CREATE POLICY "Anyone can read active products" ON public.produtos 
    FOR SELECT USING (status = 'active');

CREATE POLICY "Vendors can manage own products" ON public.produtos 
    FOR ALL USING (auth.uid() = vendedor_id);


-- ============================================================
-- 3. PEDIDOS (Registros de intenções de compra no checkout)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT,
    cliente_email TEXT,
    cliente_telefone TEXT,
    metodo_pagamento TEXT,
    valor NUMERIC(10, 2),
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'falhou', 'redirecionado')),
    transaction_id TEXT NOT NULL UNIQUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Allow public checkout to insert and update pedidos
CREATE POLICY "Public can insert orders" ON public.pedidos 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update orders" ON public.pedidos 
    FOR UPDATE USING (true);

-- Allow vendors to read orders for their products
CREATE POLICY "Vendors can read orders of their products" ON public.pedidos 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.produtos 
            WHERE public.produtos.id = public.pedidos.produto_id 
            AND public.produtos.vendedor_id = auth.uid()
        )
    );


-- ============================================================
-- 4. VENDAS (Vendas bem-sucedidas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    id_do_vendor UUID REFERENCES public.usuarios(id) ON DELETE CASCADE, -- Alias de compatibilidade
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT,
    cliente_email TEXT,
    cliente_telefone TEXT,
    valor_total NUMERIC(10, 2) NOT NULL,
    valor_liquido NUMERIC(10, 2) NOT NULL,
    valor_líquido NUMERIC(10, 2), -- Alias de compatibilidade
    metodo_pagamento TEXT,
    método_pagamento TEXT, -- Alias de compatibilidade
    status_venda TEXT DEFAULT 'sucesso',
    transaction_id TEXT,
    id_da_transação TEXT, -- Alias de compatibilidade
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    pago_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for vendas
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Allow public checkout/webhook to insert sales
CREATE POLICY "Public can insert sales" ON public.vendas 
    FOR INSERT WITH CHECK (true);

-- Allow vendors to view their own sales records
CREATE POLICY "Vendors can read own sales" ON public.vendas 
    FOR SELECT USING (
        auth.uid() = vendedor_id OR auth.uid() = id_do_vendor
    );


-- ============================================================
-- 5. SAQUES (Solicitações de saques dos vendedores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    valor NUMERIC(10, 2), -- Alias de compatibilidade
    valor_solicitado NUMERIC(10, 2),
    valor_liquido NUMERIC(10, 2),
    metodo TEXT CHECK (metodo IN ('emola', 'mpesa')),
    dados_carteira TEXT,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL -- Alias de compatibilidade
);

-- Enable RLS for saques
ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;

-- Allow vendors to view and insert their own withdrawals
CREATE POLICY "Vendors can view own withdrawals" ON public.saques 
    FOR SELECT USING (auth.uid() = vendedor_id);

CREATE POLICY "Vendors can request withdrawal" ON public.saques 
    FOR INSERT WITH CHECK (auth.uid() = vendedor_id);


-- ============================================================
-- 6. LEADS (Clientes em potencial capturados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT,
    cliente_email TEXT,
    cliente_telefone TEXT,
    cliente_endereco TEXT,
    mensagem TEXT,
    status TEXT DEFAULT 'novo',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow public insertion for leads during checkout
CREATE POLICY "Public can insert leads" ON public.leads 
    FOR INSERT WITH CHECK (true);

-- Allow vendors to read leads of their products
CREATE POLICY "Vendors can read own product leads" ON public.leads 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.produtos 
            WHERE public.produtos.id = public.leads.produto_id 
            AND public.produtos.vendedor_id = auth.uid()
        )
    );


-- ============================================================
-- 7. DEPOIMENTOS_TEXTO (Depoimentos em texto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.depoimentos_texto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    stars INTEGER CHECK (stars >= 1 AND stars <= 5),
    depoimento TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.depoimentos_texto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.depoimentos_texto 
    FOR SELECT USING (true);

CREATE POLICY "Vendors can manage reviews" ON public.depoimentos_texto 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.produtos 
            WHERE public.produtos.id = public.depoimentos_texto.produto_id 
            AND public.produtos.vendedor_id = auth.uid()
        )
    );


-- ============================================================
-- 8. DEPOIMENTOS_IMAGEM (Depoimentos em print/imagem)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.depoimentos_imagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    imagem_url TEXT NOT NULL, -- Armazena dados base64 da imagem
    legenda TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.depoimentos_imagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view image reviews" ON public.depoimentos_imagem 
    FOR SELECT USING (true);

CREATE POLICY "Vendors can manage image reviews" ON public.depoimentos_imagem 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.produtos 
            WHERE public.produtos.id = public.depoimentos_imagem.produto_id 
            AND public.produtos.vendedor_id = auth.uid()
        )
    );


-- ============================================================
-- 9. WEBHOOKS (Configuração de Webhooks para integradores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    evento TEXT DEFAULT 'venda.sucesso',
    segredo TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for webhooks
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Allow vendors to manage their own webhooks
CREATE POLICY "Vendors can manage own webhooks" ON public.webhooks 
    FOR ALL USING (auth.uid() = vendedor_id);


-- ============================================================
-- 10. TRANSACTIONS (Alternativa/Log local de transações)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE,
    status TEXT,
    amount NUMERIC(10, 2),
    method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow public integration updates
CREATE POLICY "Public webhook can manage transactions" ON public.transactions 
    FOR ALL USING (true);
