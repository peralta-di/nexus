-- Cuentas en la nube y reglas de seguridad para abrir Nexus al público.
-- 1) Cada persona entra con email y contraseña (Supabase Auth) desde cualquier dispositivo, y su progreso se guarda acá.
-- 2) Perfiles, grupos, mensajes y archivos exigen sesión iniciada, y cada uno solo puede escribir a su nombre.
-- 3) Los mensajes de un grupo solo los leen sus integrantes; los mensajes directos, solo las dos personas.
-- El identificador de cada persona en students / members / messages / listings.uid es su id de Supabase Auth (auth.uid()).

-- ---------- 1) Datos de cada cuenta ----------
create table if not exists user_data (
  auth_id uuid primary key references auth.users on delete cascade,
  profile jsonb not null default '{}'::jsonb,   -- nombre, universidad, carrera, foto, descripción, aceptación de términos…
  data jsonb,                                    -- materias, plan, apuntes, calendario, progreso
  rev bigint not null default 1,                 -- número de versión: evita que un dispositivo pise cambios más nuevos de otro
  updated_at timestamptz not null default now()
);
alter table user_data enable row level security;
drop policy if exists "mis datos" on user_data;
create policy "mis datos" on user_data for all to authenticated
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- ---------- 2) Se quitan las reglas abiertas de la primera versión ----------
do $$ declare t text; begin
  foreach t in array array['students','groups','members','messages','listing_events'] loop
    execute format('drop policy if exists "abierto" on %I', t);
  end loop; end $$;
drop policy if exists "subir archivos" on storage.objects;

-- ¿La persona con sesión puede leer o escribir en esta conversación?
-- Grupo: si es integrante. Mensaje directo ("dm:<id1>:<id2>"): si es una de las dos personas.
create or replace function public.puede_chatear(gid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when gid like 'dm:%' then
      array_length(string_to_array(substr(gid, 4), ':'), 1) = 2
      and auth.uid()::text = any (string_to_array(substr(gid, 4), ':'))
    else exists (select 1 from members m where m.group_id = gid and m.uid = auth.uid()::text)
  end
$$;
revoke all on function public.puede_chatear(text) from public, anon;
grant execute on function public.puede_chatear(text) to authenticated;

-- ---------- 3) Perfiles públicos (solo para quien tiene cuenta) ----------
drop policy if exists "ver perfiles" on students;
drop policy if exists "crear mi perfil" on students;
drop policy if exists "editar mi perfil" on students;
drop policy if exists "borrar mi perfil" on students;
create policy "ver perfiles" on students for select to authenticated using (true);
create policy "crear mi perfil" on students for insert to authenticated with check (uid = auth.uid()::text);
create policy "editar mi perfil" on students for update to authenticated using (uid = auth.uid()::text) with check (uid = auth.uid()::text);
create policy "borrar mi perfil" on students for delete to authenticated using (uid = auth.uid()::text);

-- ---------- 4) Grupos: los ve quien tiene cuenta; los crea, edita o borra su dueño ----------
drop policy if exists "ver grupos" on groups;
drop policy if exists "crear grupo" on groups;
drop policy if exists "editar mi grupo" on groups;
drop policy if exists "borrar mi grupo" on groups;
create policy "ver grupos" on groups for select to authenticated using (true);
create policy "crear grupo" on groups for insert to authenticated with check (owner = auth.uid()::text and id not like 'dm:%');
create policy "editar mi grupo" on groups for update to authenticated using (owner = auth.uid()::text) with check (owner = auth.uid()::text and id not like 'dm:%');
create policy "borrar mi grupo" on groups for delete to authenticated using (owner = auth.uid()::text);

-- ---------- 5) Integrantes: cada uno se suma o se va solo a sí mismo, y solo a grupos que existen ----------
drop policy if exists "ver integrantes" on members;
drop policy if exists "sumarme" on members;
drop policy if exists "irme" on members;
create policy "ver integrantes" on members for select to authenticated using (true);
create policy "sumarme" on members for insert to authenticated
  with check (uid = auth.uid()::text and exists (select 1 from groups g where g.id = group_id));
create policy "irme" on members for delete to authenticated using (uid = auth.uid()::text);

-- ---------- 6) Mensajes: privados para cada grupo o conversación ----------
drop policy if exists "leer mis conversaciones" on messages;
drop policy if exists "escribir a mi nombre" on messages;
drop policy if exists "borrar mis mensajes" on messages;
create policy "leer mis conversaciones" on messages for select to authenticated using (public.puede_chatear(group_id));
create policy "escribir a mi nombre" on messages for insert to authenticated
  with check (uid = auth.uid()::text and public.puede_chatear(group_id));
create policy "borrar mis mensajes" on messages for delete to authenticated using (uid = auth.uid()::text);

-- El nombre que acompaña cada mensaje o integrante sale del perfil de quien escribe (nadie puede firmar como otra persona).
create or replace function public.nombre_del_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select s.name into n from students s where s.uid = auth.uid()::text;
  if n is not null then new.name := n; end if;
  return new;
end $$;
drop trigger if exists nombre_mensaje on messages;
create trigger nombre_mensaje before insert on messages for each row execute function public.nombre_del_perfil();
drop trigger if exists nombre_integrante on members;
create trigger nombre_integrante before insert on members for each row execute function public.nombre_del_perfil();

-- ---------- 7) Estadísticas de la tienda: las registra quien tiene cuenta y solo las ve quien publicó ----------
drop policy if exists "registrar visita" on listing_events;
drop policy if exists "ver mis estadísticas" on listing_events;
create policy "registrar visita" on listing_events for insert to authenticated with check (uid = auth.uid()::text);
create policy "ver mis estadísticas" on listing_events for select to authenticated
  using (exists (select 1 from listings l where l.id = listing_id and l.owner_auth = auth.uid()));

-- ---------- 8) Archivos del chat: solo los sube quien está en esa conversación, dentro de su carpeta ----------
drop policy if exists "subir archivos del chat" on storage.objects;
create policy "subir archivos del chat" on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.puede_chatear((storage.foldername(name))[1]));
