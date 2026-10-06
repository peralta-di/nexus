-- Suscripción obligatoria con 1 semana gratis: se carga el medio de pago al registrarse y el primer cobro es a los 7 días.
alter table subscriptions add column if not exists trial_ends_at timestamptz;
alter table subscriptions add column if not exists trial_used boolean default false;
