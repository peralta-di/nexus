-- Tablas base de Nexus (perfiles, grupos, mensajes y tienda). Van primero: las demás migraciones las usan.
-- Se crean con la seguridad por filas activada y SIN reglas abiertas; las reglas están en 20261006060000_cuentas_y_seguridad.sql.
create table if not exists students (uid text primary key, name text, uni text, carrera text, anio int, slot text, note text, subjects text, ts bigint);
create table if not exists groups (id text primary key, subj text, subj_name text, name text, descr text, slot text, uni text, owner text, owner_name text, ts bigint);
create table if not exists members (group_id text, uid text, name text, uni text, carrera text, ts bigint, primary key (group_id, uid));
create table if not exists messages (id text primary key, group_id text, uid text, name text, text text, file_name text, file_text text, file_url text, file_type text, file_size bigint, ts bigint);
create table if not exists listings (id text primary key, uid text, seller_name text, seller_uni text, title text, kind text, subj text, subj_name text, topics text, unis text, years text, carrera text, price numeric, currency text, contact_kind text, contact text, descr text, preview text, ts bigint, active boolean default true);
create table if not exists listing_events (id text primary key, listing_id text, kind text, uid text, anio int, uni text, subj text, ts bigint);
alter table messages add column if not exists file_url text, add column if not exists file_type text, add column if not exists file_size bigint;
do $$ declare t text; begin
  foreach t in array array['students','groups','members','messages','listings','listing_events'] loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;
-- Archivos del chat (PDF, Word): se leen por link (nombre al azar); quién puede subir lo define la otra migración.
insert into storage.buckets (id, name, public, file_size_limit) values ('archivos', 'archivos', true, 10485760) on conflict (id) do nothing;
