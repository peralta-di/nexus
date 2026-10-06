-- Perfil público: foto chica (JPEG ~5 KB en base64) junto al nombre y la descripción ("note") que ya se guardaban.
alter table students add column if not exists photo text;
