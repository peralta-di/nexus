-- Tienda de Nexus (vitrina): cada estudiante publica su material con un contacto, y la compra se arregla directamente entre las personas.
-- Nexus no procesa pagos. Requiere las tablas base (20261005000000_tablas_base.sql).

-- Publicaciones: las ve quien tiene cuenta; solo quien publicó puede crear, editar o borrar la suya.
alter table listings add column if not exists owner_auth uuid;
drop policy if exists "abierto" on listings;
drop policy if exists "leer publicaciones" on listings;
drop policy if exists "crear publicaciones" on listings;
drop policy if exists "editar publicaciones" on listings;
drop policy if exists "borrar publicaciones" on listings;
create policy "leer publicaciones" on listings for select to authenticated using (true);
create policy "crear publicaciones" on listings for insert to authenticated with check (owner_auth = auth.uid() and uid = auth.uid()::text);
create policy "editar publicaciones" on listings for update to authenticated using (owner_auth = auth.uid()) with check (owner_auth = auth.uid() and uid = auth.uid()::text);
create policy "borrar publicaciones" on listings for delete to authenticated using (owner_auth = auth.uid());
