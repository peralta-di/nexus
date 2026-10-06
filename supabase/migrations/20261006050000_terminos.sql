-- Constancia de aceptación de los Términos y condiciones y la Política de privacidad (Ley 18.331: consentimiento informado).
create table if not exists legal_acceptances (
  id bigint generated always as identity primary key,
  auth_id uuid not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  how text,
  recorded_at timestamptz default now()
);
alter table legal_acceptances enable row level security;
create policy "registro propio" on legal_acceptances for insert with check (auth_id = auth.uid());
create policy "ver lo propio" on legal_acceptances for select using (auth_id = auth.uid());
