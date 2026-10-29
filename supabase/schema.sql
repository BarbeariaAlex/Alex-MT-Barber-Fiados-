-- =====================================================
-- BARBEARIA ALEX - BANCO DE DADOS DE FIADOS
-- PostgreSQL / Supabase
-- =====================================================

create extension if not exists pgcrypto;

-- 1. TABELA DE CLIENTES
create table if not exists public.clientes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    token text not null unique,
    created_at timestamptz not null default now()
);

-- 2. TABELA DE PENDÊNCIAS / FIADOS
create table if not exists public.pendencias (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null
        references public.clientes(id) on delete restrict,
    amount numeric(10,2) not null check (amount > 0),
    type text not null check (type in ('corte', 'produto')),
    description text,
    status text not null default 'aberta'
        check (status in ('aberta', 'paga')),
    created_at timestamptz not null default now(),
    paid_at timestamptz
);

-- 3. ÍNDICES
create index if not exists idx_clientes_token
    on public.clientes(token);

create index if not exists idx_pendencias_cliente
    on public.pendencias(cliente_id);

create index if not exists idx_pendencias_status
    on public.pendencias(status);

create index if not exists idx_pendencias_created
    on public.pendencias(created_at desc);

-- 4. SEGURANÇA: HABILITAR RLS
alter table public.clientes enable row level security;
alter table public.pendencias enable row level security;

-- 5. REMOVER POLÍTICAS ADMINISTRATIVAS ANTERIORES
drop policy if exists "admin select clientes"
    on public.clientes;
drop policy if exists "admin insert clientes"
    on public.clientes;
drop policy if exists "admin update clientes"
    on public.clientes;

drop policy if exists "admin select pendencias"
    on public.pendencias;
drop policy if exists "admin insert pendencias"
    on public.pendencias;
drop policy if exists "admin update pendencias"
    on public.pendencias;

-- 6. PERMISSÕES DO ADMINISTRADOR
create policy "admin select clientes"
on public.clientes
for select
to authenticated
using (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

create policy "admin insert clientes"
on public.clientes
for insert
to authenticated
with check (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

create policy "admin update clientes"
on public.clientes
for update
to authenticated
using (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
)
with check (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

create policy "admin select pendencias"
on public.pendencias
for select
to authenticated
using (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

create policy "admin insert pendencias"
on public.pendencias
for insert
to authenticated
with check (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

create policy "admin update pendencias"
on public.pendencias
for update
to authenticated
using (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
)
with check (
    (auth.jwt() ->> 'email') = 'luizassistencia813@gmail.com'
);

-- 7. FUNÇÃO DE CONSULTA DA CONTA DO CLIENTE
create or replace function public.consultar_conta_cliente(
    p_token text
)
returns json
language sql
security definer
set search_path = ''
as $func$
    select json_build_object(
        'client',
        json_build_object(
            'id', c.id,
            'name', c.name,
            'phone', c.phone,
            'token', c.token,
            'created_at', c.created_at
        ),
        'debts',
        coalesce(
            (
                select json_agg(
                    json_build_object(
                        'id', p.id,
                        'cliente_id', p.cliente_id,
                        'amount', p.amount,
                        'type', p.type,
                        'description', p.description,
                        'status', p.status,
                        'created_at', p.created_at,
                        'paid_at', p.paid_at
                    )
                    order by p.created_at desc
                )
                from public.pendencias p
                where p.cliente_id = c.id
            ),
            '[]'::json
        )
    )
    from public.clientes c
    where c.token = p_token
    limit 1;
$func$;

-- 8. PERMISSÕES DE EXECUÇÃO DA FUNÇÃO
revoke all
on function public.consultar_conta_cliente(text)
from public;

grant execute
on function public.consultar_conta_cliente(text)
to anon, authenticated;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================