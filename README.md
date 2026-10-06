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
Ingreso con cuenta, suscripción con semana gratis y tienda en modo demo (pagos simulados), onboarding, plan adaptativo, modo rescate, materias, ejercicios, simulador, logros, Study Match, y **subir apuntes** (PDF, Word, PowerPoint, TXT y fotos, también desde el celular y desde Drive vía el selector de archivos). El tutor funciona en modo guiado.

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
- **Perfil público:** en Grupos, Mensajes y la Tienda se ven el nombre, la foto (versión chica), la descripción "Sobre mí" (hasta 160 caracteres), la carrera, el año, la facultad y las materias. Nunca el email ni la contraseña. Tocando a una persona se abre su perfil, con las materias en común y un botón para escribirle.
- En la tienda, además, se ve el contacto que cada persona elige publicar.
- Nexus no cobra ni intermedia pagos.

## Cobros: suscripción y comisión por ventas (Mercado Pago)
- **Suscripción obligatoria con 1 semana gratis:** apenas alguien se registra o inicia sesión, antes de usar la app, tiene que activar la suscripción en Mercado Pago. Ahí carga su tarjeta de crédito, débito o su cuenta de Mercado Pago, y **hoy no se le cobra nada**: el primer cobro de **$400** es a los 7 días, y después todos los meses. Si cancela durante la semana, no se le cobra y sigue usando Nexus hasta que termina la semana. La semana gratis se da una sola vez por persona. Todo el dinero va **directo a tu cuenta de Mercado Pago** (la del `MP_ACCESS_TOKEN`).
  - **Alternativa:** si una tarjeta de débito no acepta débito automático, está **"Pagar 1 mes ahora"**, un cobro único de $400 con crédito, débito o dinero en Mercado Pago. Da acceso inmediato y no se renueva solo.
- **Mi perfil → Mi suscripción:** muestra el estado (semana gratis, débito automático con fecha del próximo cobro, pagada hasta tal fecha) y permite **cancelar en cualquier momento** con un paso de confirmación. Al cancelar no se cobra más, y la persona sigue con acceso hasta el final de lo que ya pagó.
- **Tienda:** quien compra paga dentro de Nexus con Mercado Pago. A quien vende le llega el 90 % a su propia cuenta y **Nexus se queda automáticamente con el 10 %** (comisión de Mercado Pago Marketplace). El archivo y el contacto se entregan recién cuando el pago está aprobado, en **Mis compras**. Antes de comprar, se puede preguntar por Mensajes. El material gratis no paga comisión.
- **Orden de la tienda:** recomendado (según tus materias, temas flojos y parciales), más vendidos, más barato, más caro y más nuevo.
- **Modo demo:** sin configurar nada, todo esto funciona simulado en el navegador para probarlo.

### Activar los cobros reales
Hace falta Supabase (ver arriba, con `SUPA` completado) y una cuenta de Mercado Pago.
1. **Mercado Pago:** en developers.mercadopago.com creá una aplicación (modelo de integración: *Marketplace* / pagos online). Anotá el *Access Token de producción*, el *Client ID* y el *Client Secret*. En la configuración de la aplicación, poné como **Redirect URL** `https://TU-PROYECTO.supabase.co/functions/v1/mp-oauth`.
2. **Base de datos:** en Supabase → SQL Editor, ejecutá en orden los archivos de `supabase/migrations/`: `20261006000000_pagos.sql`, `20261006010000_suscripcion_y_recordatorios.sql`, `20261006020000_recordatorios_4_por_dia.sql`, `20261006030000_semana_gratis.sql`, `20261006040000_perfil_publico.sql` y `20261006050000_terminos.sql`. Esto también cierra la tabla `listings`: desde ahora solo quien publicó (con su email verificado) puede editar o borrar su publicación.
3. **Funciones:** con la CLI de Supabase (`npm i -g supabase`, `supabase login`, `supabase link --project-ref TU-PROYECTO`):
```
supabase secrets set MP_ACCESS_TOKEN=APP_USR-... MP_CLIENT_ID=... MP_CLIENT_SECRET=... SITE_URL=https://tu-sitio/ STATE_SECRET=una-frase-larga-al-azar
supabase functions deploy pagos
supabase functions deploy mp-oauth --no-verify-jwt
supabase functions deploy mp-webhook --no-verify-jwt
supabase functions deploy recordatorios --no-verify-jwt
```
Opcionales: `COMISION` (0.10), `SUB_PRECIO` (400), `SUB_MONEDA` (UYU), `PRUEBA_DIAS` (7). Si los cambiás, cambiá también `PAGOS` al principio del script de `index.html`, que es lo que se muestra en pantalla.
4. **Avisos de pago (webhooks):** en tu aplicación de Mercado Pago → Webhooks, poné `https://TU-PROYECTO.supabase.co/functions/v1/mp-webhook` con los eventos *Pagos* y *Planes y suscripciones*. Los pagos de la tienda también avisan solos a esa dirección.
5. Probá primero con las **credenciales y usuarios de prueba** de Mercado Pago, y después cambiá a las de producción.

**Cómo funciona por dentro (para revisar):** las funciones están en `supabase/functions/`. Ningún precio ni pago sale del navegador: la función toma el precio de la base, y cada aviso de pago se vuelve a consultar a Mercado Pago antes de registrar la venta. Las ventas, los tokens de Mercado Pago de quienes venden y las suscripciones solo las escriben las funciones.

**Límites a tener en cuenta:**
- La pantalla de suscripción se controla en el navegador: alguien con conocimientos técnicos podría saltearla. Lo que se cobra y se entrega (ventas y descargas) sí lo controla el servidor.
- Mercado Pago descuenta además su propia tarifa por cada cobro.
- La comisión de Marketplace se cobra en la moneda de la cuenta de quien vende. Por eso la tienda acepta UYU y USD.
- Dentro de Claude no se puede pagar (la página no puede salir a Mercado Pago), así que esa versión no tiene pantalla de suscripción.

## Recordatorios por email (Gmail o cualquier correo)
En **Mi perfil → Recordatorios por email** cada persona activa **4 emails por día**, en su hora local (por defecto 08:00, 13:00, 17:00 y 21:00; puede cambiarlas) y los días que elige:
- **el primero:** su plan del día;
- **los dos del medio:** su próximo bloque;
- **el último:** el cierre del día y cuándo es el próximo bloque.

También avisan de los repasos pendientes. Una vez por día, en el primero, avisan si la persona lleva 2 días sin estudiar.

Cada email trae un link para darse de baja. La página manda al servidor solo los próximos bloques y la cantidad de repasos; los apuntes no se envían. Sin configurar nada, se ve una vista previa del email.

Para que se envíen de verdad:
1. Creá una cuenta en **resend.com** (tiene plan gratis), verificá tu dominio y creá una API key. Con Gmail como remitente no se puede: hace falta un dominio propio. Los emails sí llegan a casillas de Gmail.
2. `supabase secrets set RESEND_API_KEY=re_... MAIL_FROM="Nexus <recordatorios@tudominio.com>" CRON_SECRET=otra-frase-al-azar`
3. Subí la función: `supabase functions deploy recordatorios --no-verify-jwt`.
4. Programala cada hora: en Supabase → **Database → Extensions** activá `pg_cron` y `pg_net`, y en SQL Editor ejecutá (con tu proyecto y tu `CRON_SECRET`):
```sql
select cron.schedule('nexus-recordatorios', '0 * * * *', $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/recordatorios',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', 'TU_CRON_SECRET'),
    body := '{}'::jsonb)
$$);
```
5. Probalo desde Mi perfil con **Mandarme uno de prueba**.

## Términos y condiciones y privacidad
Nexus incluye **Términos y condiciones** y **Política de privacidad** pensados para Uruguay: Ley 18.331 de protección de datos, Ley 17.250 de defensa del consumidor (incluidos los 5 días de arrepentimiento) y Ley 9.739 de derechos de autor.
- **Aceptación obligatoria:** para **registrarse** y para **iniciar sesión** hay que marcar la casilla de aceptación. Se guarda la versión aceptada y la fecha; con Supabase también se guarda en la tabla `legal_acceptances`.
- **Cambios en los textos:** si los cambiás, subí `LEGAL_V` y a todas las personas se les pide aceptar la nueva versión antes de seguir.
- **Links directos:** `…/nexus/#terminos` y `…/nexus/#privacidad`.
- **Mi perfil → Legal y tus datos:** links a los textos, **Descargar mis datos** (archivo JSON) y **Borrar mi cuenta** (cancela la suscripción y borra los datos; se conservan solo los registros de pagos que exige la ley).
- **Tienda:** para publicar hay que declarar que el material es propio o que se tiene derecho a venderlo.
- **Mi suscripción:** explica cómo pedir el arrepentimiento.

**Antes de abrir al público:**
1. Completá `LEGAL` al principio del bloque "TÉRMINOS Y CONDICIONES" en `index.html`: titular, cédula o RUT, domicilio, email, departamento y número de inscripción ante la URCDP. Hoy dice "[a completar]".
2. Inscribí la base de datos ante la **URCDP**, la Unidad Reguladora y de Control de Datos Personales (trámite en línea en gub.uy).
3. Hacé **revisar los textos por un abogado** y consultá con un **contador** cómo facturar la suscripción y las comisiones.
4. En Supabase ejecutá `supabase/migrations/20261006050000_terminos.sql` y volvé a subir la función `pagos`, que ahora borra cuentas.

## Lo que hay que saber
- Todo se guarda **en el navegador de cada persona** (no hay servidor): cuenta, contraseña cifrada, plan, progreso, materias, apuntes subidos (el texto leído), guías y preguntas generadas. Se conserva al recargar y al volver otro día. Si cambia de dispositivo, usa otro navegador o borra los datos del sitio, tendrá que registrarse de nuevo.
- Las fotos o PDF escaneados se leen con la IA en el momento; después de recargar se conserva el texto ya leído, pero no el archivo original.
- Para cuentas que se compartan entre dispositivos hace falta un backend (por ejemplo Supabase o Firebase); el sitio está preparado para sumarlo después.
