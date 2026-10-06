-- Pagos de Nexus: ventas con 10 % de comisión (Mercado Pago Marketplace) y suscripción mensual con prueba gratis.
-- Requiere las tablas base (20261005000000_tablas_base.sql).

-- 1) Publicaciones: lectura pública, pero solo quien publicó (con sesión de Supabase) puede crear, editar o borrar.
alter table listings add column if not exists owner_auth uuid;
alter table listings add column if not exists has_file boolean default false;
drop policy if exists "abierto" on listings;
create policy "leer publicaciones" on listings for select using (true);
create policy "crear publicaciones" on listings for insert with check (owner_auth = auth.uid());
create policy "editar publicaciones" on listings for update using (owner_auth = auth.uid()) with check (owner_auth = auth.uid());
create policy "borrar publicaciones" on listings for delete using (owner_auth = auth.uid());

-- 2) Datos que se entregan después de la compra: contacto y archivo. Solo los ve quien publicó (y las funciones).
create table if not exists listing_private (
  listing_id text primary key references listings(id) on delete cascade,
  contact_kind text, contact text, file_path text, file_name text
);
alter table listing_private enable row level security;
create policy "dueño de la publicación" on listing_private for all
  using (exists (select 1 from listings l where l.id = listing_id and l.owner_auth = auth.uid()))
  with check (exists (select 1 from listings l where l.id = listing_id and l.owner_auth = auth.uid()));

-- 3) Cuentas de Mercado Pago de quienes venden. Sin políticas: solo las funciones (service role) las leen.
create table if not exists sellers (
  auth_id uuid primary key, mp_user_id text, access_token text, refresh_token text,
  expires_at timestamptz, updated_at timestamptz default now()
);
alter table sellers enable row level security;

-- 4) Ventas registradas por el webhook de Mercado Pago (nadie las puede escribir desde el navegador).
create table if not exists sales (
  id bigint generated always as identity primary key,
  mp_payment_id text unique not null,
  listing_id text, buyer_auth uuid, seller_auth uuid,
  amount numeric, fee numeric, currency text, status text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table sales enable row level security;
create policy "mis compras y ventas" on sales for select using (buyer_auth = auth.uid() or seller_auth = auth.uid());

-- Cantidad de ventas aprobadas por publicación (para ordenar por "más vendidos"); expone solo el número.
create or replace view listing_sales as
  select listing_id, count(*)::int as sold from sales where status = 'approved' group by listing_id;
grant select on listing_sales to anon, authenticated;

-- 5) Suscripciones mensuales (las actualiza el webhook).
create table if not exists subscriptions (
  auth_id uuid primary key, email text, status text, mp_preapproval_id text,
  next_payment_date timestamptz, updated_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "mi suscripción" on subscriptions for select using (auth_id = auth.uid());

-- 6) Archivos que se venden: espacio privado; cada persona sube solo a su carpeta y se descargan con link temporal.
insert into storage.buckets (id, name, public, file_size_limit)
  values ('ventas', 'ventas', false, 52428800) on conflict (id) do nothing;
create policy "subir archivos de venta" on storage.objects for insert to authenticated
  with check (bucket_id = 'ventas' and (storage.foldername(name))[1] = auth.uid()::text);
