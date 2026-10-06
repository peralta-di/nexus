# Nexus — página web lista para publicar

Esta carpeta es **todo el sitio**: `index.html` más la carpeta `vendor/` (librerías y letra). No hay que instalar nada ni compilar.

## Probarlo en tu compu
Hacé doble clic en `index.html`. React, la letra (DM Sans) y las librerías para leer PDF y Word están en la carpeta `vendor/` (con sus licencias en `vendor/licencias/`): la página no carga nada de servidores de terceros.

## Publicarlo gratis (elegí una)
- **Netlify Drop:** entrá a app.netlify.com/drop y arrastrá esta carpeta. Te da un link en segundos.
- **GitHub Pages:** subí `index.html` a un repositorio → Settings → Pages → rama `main`, carpeta `/ (root)`.
- **Vercel / Cloudflare Pages:** creá un proyecto nuevo y subí la carpeta (sin comando de build).

Tiene que servirse por **HTTPS** (todos los de arriba lo hacen); lo necesita el cifrado de contraseñas del navegador.

## Qué funciona sin configurar nada
Ingreso con cuenta, uso gratuito, tienda en modo demo (pagos simulados), onboarding, plan adaptativo, modo rescate, materias, ejercicios, simulador, logros, Study Match, y **subir apuntes** (PDF, Word, PowerPoint, TXT y fotos, también desde el celular y desde Drive vía el selector de archivos). El tutor funciona en modo guiado.

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

## Cuentas en la nube (entrar desde cualquier dispositivo)
Cuando el sitio tiene Supabase configurado:
- **Registro:** nombre, email, contraseña y datos de la carrera. Se manda un **código de 6 dígitos** al email y la cuenta se crea recién cuando la persona lo escribe (con reenvío cada 60 segundos y opción de cambiar el email).
- **Inicio de sesión:** email y contraseña, desde el celular, la compu o cualquier navegador. El perfil y todo el progreso (materias, plan, apuntes, calendario, racha, recordatorios) se guardan en la nube unos segundos después de cada cambio y se traen al entrar.
- **Olvidé mi contraseña:** manda un código al email y permite elegir una contraseña nueva.
- **Dos dispositivos a la vez:** cada guardado lleva un número de versión. Si un dispositivo quedó desactualizado, en vez de pisar lo más nuevo trae los cambios del otro y avisa.
- **Cerrar sesión** sube lo último y borra la copia de ese dispositivo (útil en compus compartidas).
- Sin Supabase configurado (o dentro de Claude), las cuentas siguen funcionando como antes: solo en ese navegador.

## Configurar Supabase (cuentas, grupos, mensajes y tienda)
1. Creá un proyecto en supabase.com y **elegí la región South America (São Paulo)**, que es la que figura en la Política de privacidad.
2. En **SQL Editor**, ejecutá **en orden** todos los archivos de `supabase/migrations/` (el nombre empieza con la fecha, así que el orden alfabético es el correcto). El primero, `20261005000000_tablas_base.sql`, crea las tablas; el último, `20261006060000_cuentas_y_seguridad.sql`, crea la tabla de cuentas y las reglas de seguridad.
   - **Si ya tenías las tablas de una versión anterior** (con las reglas "abierto"), ejecutá igual los archivos que te falten: `20261006060000_cuentas_y_seguridad.sql` borra las reglas abiertas y pone las nuevas.
3. En **Project Settings → API**, copiá la URL y la clave `anon` (pública) y escribilas al principio del script: `const SUPA={url:'https://xxxx.supabase.co',key:'…'};`. La clave `anon` puede estar en la página: lo que protege los datos son las reglas del paso 2. **Nunca** pongas la clave `service_role` en la página.
4. En **Authentication → Sign In / Providers → Email**: dejá activado el proveedor Email y "Allow new users to sign up". La longitud mínima de contraseña de Nexus es 6; si en Supabase ponés más, avisale a la gente en el registro.
5. En **Authentication → Email Templates → Magic Link**, cambiá el cuerpo para que muestre el código (se usa para el registro y para recuperar la contraseña), por ejemplo: `<h2>Tu código de Nexus</h2><p>Escribí este código en Nexus: <b>{{ .Token }}</b></p><p>Vence en 1 hora.</p>`
6. **Importante:** el correo que trae Supabase por defecto solo envía a los emails del equipo del proyecto, y pocos por hora. Para que les llegue a todos, en **Authentication → SMTP Settings** conectá un servicio de correo (por ejemplo Resend) con un remitente propio.
7. En **Authentication → URL Configuration**, poné como *Site URL* la dirección pública de Nexus.

Sin Supabase, los grupos, los mensajes directos y la tienda funcionan en **modo demo**: compañeros y publicaciones de ejemplo, todo en el navegador.

### Quién puede ver y hacer qué (reglas de seguridad)
Probadas con 51 casos en una base PostgreSQL:
- Sin sesión iniciada no se puede leer ni escribir nada (perfiles, grupos, mensajes, cuentas).
- Cada persona solo lee y modifica **sus propios datos de cuenta y progreso**.
- Los perfiles públicos y la lista de grupos los ve cualquiera con cuenta; cada uno edita solo el suyo.
- **Mensajes de grupo:** solo los leen y escriben sus integrantes. Quien se va del grupo deja de verlos.
- **Mensajes directos:** solo las dos personas de la conversación.
- Nadie puede escribir a nombre de otro: el nombre de cada mensaje sale del perfil de quien lo manda.
- **Archivos del chat:** solo los sube quien está en esa conversación. Se descargan por un link con nombre al azar, que solo ven quienes pueden leer el mensaje.
- Las estadísticas de una publicación solo las ve quien la publicó.
- **Borrar mi cuenta** borra también el perfil, los mensajes, los grupos a los que pertenece y el progreso guardado.

- **Perfil público:** en Grupos, Mensajes y la Tienda se ven el nombre, la foto (versión chica), la descripción "Sobre mí" (hasta 160 caracteres), la carrera, el año, la facultad y las materias. Nunca el email ni la contraseña. Tocando a una persona se abre su perfil, con las materias en común y un botón para escribirle.
- En la tienda, el contacto de quien vende solo lo ve quien le compró.

## Nexus es gratuito
- **Sin suscripción:** cualquiera se registra y usa todo Nexus sin pagar. No hay período de prueba ni cobros automáticos.
- **Sin comisión:** en la Tienda, quien compra paga con Mercado Pago y la plata le llega **completa** a quien vende (Mercado Pago le descuenta su propia tarifa). Nexus no cobra nada. El archivo y el contacto se entregan recién cuando el pago está aprobado, en **Mis compras**. Antes de comprar, se puede preguntar por Mensajes.
- **Orden de la tienda:** recomendado (según tus materias, temas flojos y parciales), más vendidos, más barato, más caro y más nuevo.
- **Modo demo:** sin configurar nada, todo esto funciona simulado en el navegador para probarlo.

### Activar los pagos reales de la Tienda
Solo hace falta si querés que en la Tienda se pueda pagar dentro de Nexus. Necesitás Supabase (ver arriba, con `SUPA` completado) y una cuenta de Mercado Pago (no recibe dinero: solo identifica tu aplicación).
1. **Mercado Pago:** en developers.mercadopago.com creá una aplicación (modelo de integración: *Marketplace* / pagos online). Anotá el *Client ID* y el *Client Secret*. En la configuración de la aplicación, poné como **Redirect URL** `https://TU-PROYECTO.supabase.co/functions/v1/mp-oauth`.
2. **Base de datos:** ejecutá en orden todos los archivos de `supabase/migrations/` (ver *Configurar Supabase*). Esto también cierra la tabla `listings`: solo quien publicó puede editar o borrar su publicación.
3. **Funciones:** con la CLI de Supabase (`npm i -g supabase`, `supabase login`, `supabase link --project-ref TU-PROYECTO`):
```
supabase secrets set MP_CLIENT_ID=... MP_CLIENT_SECRET=... SITE_URL=https://tu-sitio/ STATE_SECRET=una-frase-larga-al-azar
supabase functions deploy pagos
supabase functions deploy mp-oauth --no-verify-jwt
supabase functions deploy mp-webhook --no-verify-jwt
supabase functions deploy recordatorios --no-verify-jwt
```
Opcional: `COMISION` (por defecto 0, sin comisión). Si algún día querés cobrar una, tendrías que cambiar también `PAGOS` en `index.html` y los Términos y condiciones.
4. **Avisos de pago (webhooks):** en tu aplicación de Mercado Pago → Webhooks, poné `https://TU-PROYECTO.supabase.co/functions/v1/mp-webhook` con el evento *Pagos*. Los pagos de la tienda también avisan solos a esa dirección.
5. Probá primero con las **credenciales y usuarios de prueba** de Mercado Pago, y después cambiá a las de producción.

**Cómo funciona por dentro (para revisar):** las funciones están en `supabase/functions/`. Ningún precio ni pago sale del navegador: la función toma el precio de la base, y cada aviso de pago se vuelve a consultar a Mercado Pago antes de registrar la venta. Las ventas y los tokens de Mercado Pago de quienes venden solo los escriben las funciones.

**Límites a tener en cuenta:**
- Lo que se cobra y se entrega (ventas y descargas) lo controla el servidor.
- Mercado Pago descuenta además su propia tarifa por cada cobro.
- Dentro de Claude no se puede pagar en la Tienda (la página no puede salir a Mercado Pago).

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
- **Mi perfil → Legal y tus datos:** links a los textos, **Descargar mis datos** (archivo JSON) y **Borrar mi cuenta** (borra los datos; se conservan solo los registros de compras y ventas que pueda exigir la ley).
- **Tienda:** para publicar hay que declarar que el material es propio o que se tiene derecho a venderlo.

**Antes de abrir al público:**
1. Los datos del titular están en `LEGAL`, en `index.html`: hoy figura **Diana Peralta (nombre comercial: Nexus)** con su email. Si querés, agregá la cédula o el RUT, el domicilio, el departamento y, cuando lo tengas, el número de inscripción ante la URCDP. Los campos vacíos no se muestran.
2. Inscribí la base de datos ante la **URCDP**, la Unidad Reguladora y de Control de Datos Personales (trámite en línea en gub.uy).
3. Hacé **revisar los textos por un abogado** y consultá con un **contador** si necesitás registrarte de alguna forma aunque Nexus sea gratuito.
4. En Supabase ejecutá las migraciones que falten (ver *Configurar Supabase*) y volvé a subir la función `pagos`, que borra cuentas completas.

## Lo que hay que saber
- **Con Supabase configurado**, la cuenta y el progreso se guardan en la nube y se sincronizan entre dispositivos; cada dispositivo guarda además una copia para funcionar rápido. **Sin Supabase**, todo queda en el navegador de cada persona: si cambia de dispositivo o borra los datos del sitio, tendrá que registrarse de nuevo.
- Las fotos o PDF escaneados se leen con la IA en el momento; después de recargar se conserva el texto ya leído, pero no el archivo original.
