-- Suscripción: pagos de "1 mes" (crédito, débito o dinero en Mercado Pago) y acceso pagado hasta una fecha.
alter table subscriptions add column if not exists paid_until timestamptz;
create table if not exists sub_payments (
  mp_payment_id text primary key, auth_id uuid, amount numeric, currency text, created_at timestamptz default now()
);
alter table sub_payments enable row level security;  -- sin políticas: solo las funciones

-- Recordatorios por email: cada persona guarda los suyos (y solo a su propio email).
create table if not exists reminders (
  auth_id uuid primary key,
  email text not null,
  enabled boolean default true,
  hour int default 18 check (hour between 0 and 23),
  days text default '0123456',
  tz text default 'America/Montevideo',
  kinds text default 'sesiones,repasos,inactividad',
  name text,
  blocks jsonb default '[]',
  reviews int default 0,
  last_active timestamptz,
  last_sent_date text,
  updated_at timestamptz default now()
);
alter table reminders enable row level security;
create policy "mis recordatorios" on reminders for all
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid() and email = (auth.jwt() ->> 'email'));
