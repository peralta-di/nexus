-- Recordatorios: 4 por día, a las horas locales que elige cada persona (por defecto 8, 13, 17 y 21).
alter table reminders add column if not exists hours text default '8,13,17,21';
alter table reminders add column if not exists last_sent_slot text;  -- "AAAA-MM-DD@hora" del último envío, para no repetir
