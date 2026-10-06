# Nexus — página web lista para publicar

Esta carpeta es **todo el sitio**: un solo archivo, `index.html`. No hay que instalar nada ni compilar.

## Probarlo en tu compu
Hacé doble clic en `index.html` (necesita internet para cargar React, la tipografía y Tailwind desde sus CDN).

## Publicarlo gratis (elegí una)
- **Netlify Drop:** entrá a app.netlify.com/drop y arrastrá esta carpeta. Te da un link en segundos.
- **GitHub Pages:** subí `index.html` a un repositorio → Settings → Pages → rama `main`, carpeta `/ (root)`.
- **Vercel / Cloudflare Pages:** creá un proyecto nuevo y subí la carpeta (sin comando de build).

Tiene que servirse por **HTTPS** (todos los de arriba lo hacen); lo necesita el cifrado de contraseñas del navegador.

## Qué funciona sin configurar nada
Ingreso con cuenta, onboarding, plan adaptativo, modo rescate, materias, ejercicios, simulador, logros, Study Match, y **subir apuntes** (PDF, Word, PowerPoint, TXT y fotos, también desde el celular y desde Drive vía el selector de archivos). El tutor funciona en modo guiado.

## Activar la IA (opcional)
El tutor con IA, la guía de estudio, las preguntas desde tus apuntes y la lectura de fotos necesitan una clave de la API de Anthropic. Cada persona la pega en **Mi perfil → IA del tutor**. La clave se guarda solo en su navegador y se envía únicamente a api.anthropic.com. No pongas tu clave dentro del archivo.

## Estudiar con tu material
En **Apuntes → Estudiar con tu material**, Nexus divide tus documentos en temas (usa los títulos de cada parte; con la IA lo hace mejor), estima cuántos bloques de 45 minutos lleva cada uno y arma tu cronograma con esos temas. Durante cada bloque ves la parte de tu material que corresponde.

## Materias de Medicina · UdelaR
En la configuración (o en **Materias → + Materias**) podés elegir las materias de la Facultad de Medicina de la UdelaR (Plan 2008) por año. Si la tuya tiene otro nombre, escribila.

## Usar la IA con la cuenta de Claude de cada persona
- **Nexus dentro de Claude:** Nexus también está publicado como página de claude.ai. Abierto ahí, el tutor, la guía, los temas y los ejercicios usan la cuenta de Claude de quien lo abre: sin clave, y la primera vez Claude le pide permiso. El link es https://claude.ai/artifact/WsunKkPTN3zjemT6s3RUp4 (está en `CLAUDE_APP_URL`); para que otros lo usen, compartilo desde el menú Compartir de esa página. Está (al principio del script) y aparece en **Mi perfil** y en el **Tutor**.
- **Seguir en Claude:** en el sitio publicado aparte, los botones "Seguir en Claude ↗" y "Estudiar este material en Claude ↗" abren claude.ai con la sesión de la persona y un pedido ya armado con su carrera, sus parciales, sus temas flojos, sus errores y su material.
- **Clave de API (avanzado):** sigue estando en Mi perfil, para usar la IA dentro del sitio publicado aparte.

## Verificación del email al registrarse
Cuando el sitio tiene Supabase configurado, al crear la cuenta se manda un **código de 6 dígitos** al email, y la cuenta se crea recién cuando la persona lo escribe. Tiene reenvío (cada 60 segundos) y opción de cambiar el email. Sin Supabase configurado, el registro sigue funcionando sin verificar. Dentro de Claude no se pide código, porque ahí la persona ya entró con su cuenta.

Para activarla:
1. Hacé los pasos 1 y 2 de la sección de abajo (proyecto de Supabase y tablas).
2. Escribí la URL y la clave `anon` del proyecto en el código, al principio del script: `const SUPA={url:'https://xxxx.supabase.co',key:'…'};`. Así funciona para todos desde el registro, sin que nadie tenga que pegar nada.
3. En Supabase, **Authentication → Email Templates → Magic Link**, cambiá el cuerpo para que muestre el código, por ejemplo: `<h2>Tu código de Nexus</h2><p>Escribí este código en Nexus: <b>{{ .Token }}</b></p><p>Vence en 1 hora.</p>`
4. **Importante:** el correo que trae Supabase por defecto solo envía a los emails del equipo del proyecto, y pocos por hora. Para que les llegue a todos, en **Authentication → SMTP Settings** conectá un servicio de correo (por ejemplo Resend o Brevo, que tienen plan gratis) con un remitente propio.

## Grupos de estudio y tienda en línea (opcional)
Sin configurar nada, los grupos, los mensajes directos y la tienda funcionan en **modo demo**: hay compañeros y publicaciones de ejemplo, y todo queda en tu navegador. Para que se conozca gente real, se chatee, se compartan archivos y se publique material:
1. Creá un proyecto gratis en supabase.com.
2. En **SQL Editor**, ejecutá:
```sql
create table students (uid text primary key, name text, uni text, carrera text, anio int, slot text, note text, subjects text, ts bigint);
create table groups (id text primary key, subj text, subj_name text, name text, descr text, slot text, uni text, owner text, owner_name text, ts bigint);
create table members (group_id text, uid text, name text, uni text, carrera text, ts bigint, primary key (group_id, uid));
create table messages (id text primary key, group_id text, uid text, name text, text text, file_name text, file_text text, file_url text, file_type text, file_size bigint, ts bigint);
create table listings (id text primary key, uid text, seller_name text, seller_uni text, title text, kind text, subj text, subj_name text, topics text, unis text, years text, carrera text, price numeric, currency text, contact_kind text, contact text, descr text, preview text, ts bigint, active boolean default true);
create table listing_events (id text primary key, listing_id text, kind text, uid text, anio int, uni text, subj text, ts bigint);
do $$ declare t text; begin
  foreach t in array array['students','groups','members','messages','listings','listing_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "abierto" on %I for all using (true) with check (true)', t);
  end loop; end $$;
-- Archivos del chat (PDF, Word): espacio público "archivos"
insert into storage.buckets (id, name, public, file_size_limit) values ('archivos', 'archivos', true, 10485760);
create policy "subir archivos" on storage.objects for insert to anon with check (bucket_id = 'archivos');
```
Si ya habías creado las tablas antes, agregá solo lo nuevo:
```sql
alter table messages add column file_url text, add column file_type text, add column file_size bigint;
```
y después ejecutá las líneas de `listings`, `listing_events` y `archivos`.

3. En **Project Settings → API**, copiá la URL y la clave `anon` (pública) y escribilas en `SUPA`, al principio del script, para que valga para todos. Para probar en tu navegador, también podés pegarlas en **Mi perfil → Grupos en línea**.

**Importante:** con estas reglas, cualquiera que tenga la clave pública puede leer y escribir en los grupos y en la tienda, y los archivos subidos quedan públicos para quien tenga el link. Alcanza para un grupo de compañeros. Para abrirlo al público conviene sumar el inicio de sesión de Supabase, reglas más estrictas y moderación de la tienda.
- Los **mensajes directos** (botón *Mensaje* al lado de cada persona, y la pestaña *Mensajes*) se guardan en la misma tabla `messages` que los chats de grupo, así que tampoco son privados frente a quien tenga la clave.
- En los grupos y la tienda se comparte nombre, universidad, carrera, año y materias; nunca el email ni la contraseña.
- En la tienda, además, se ve el contacto que cada persona elige publicar.
- Nexus no cobra ni intermedia pagos.

## Lo que hay que saber
- Todo se guarda **en el navegador de cada persona** (no hay servidor): cuenta, contraseña cifrada, plan, progreso, materias, apuntes subidos (el texto leído), guías y preguntas generadas. Se conserva al recargar y al volver otro día. Si cambia de dispositivo, usa otro navegador o borra los datos del sitio, tendrá que registrarse de nuevo.
- Las fotos o PDF escaneados se leen con la IA en el momento; después de recargar se conserva el texto ya leído, pero no el archivo original.
- Para cuentas que se compartan entre dispositivos hace falta un backend (por ejemplo Supabase o Firebase); el sitio está preparado para sumarlo después.
