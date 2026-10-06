// Recordatorios de estudio por email (llegan a Gmail o a cualquier casilla).
// La página guarda en la tabla "reminders" los próximos bloques y repasos de cada persona;
// esta función corre cada hora (pg_cron) y manda un email por día, a la hora que cada persona eligió.
//
// Variables de entorno:
//   RESEND_API_KEY   clave de resend.com (servicio de envío de emails)
//   MAIL_FROM        remitente verificado en Resend, por ejemplo "Aulario <recordatorios@tudominio.com>"
//   CRON_SECRET      frase al azar; pg_cron la manda en el encabezado x-cron-secret
//   SITE_URL, STATE_SECRET (las mismas que para pagos)

import { authUser, CORS, db, env, hmac, json, SB } from "./pagos.ts";

type Block = { start: string; topic: string; subject: string; review?: boolean };
type Row = {
  auth_id: string; email: string; enabled: boolean; hour: number; days: string; tz: string; kinds: string;
  name: string | null; blocks: Block[] | null; reviews: number | null; last_active: string | null; last_sent_date: string | null;
};

const enc = encodeURIComponent;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const site = () => env("SITE_URL").replace(/\/?$/, "/");

/* Fecha, hora y día de la semana en la zona horaria de la persona */
export function localParts(d: Date, tz: string) {
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }); }
  catch (_) { f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }); tz = "America/Montevideo"; }
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: wd, tz };
}
const hhmm = (iso: string, tz: string) => {
  try { return new Intl.DateTimeFormat("es-UY", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); }
  catch (_) { return new Date(iso).toISOString().slice(11, 16); }
};

async function unsubToken(id: string) { return id + "." + (await hmac("baja." + id)); }
async function readUnsub(t: string) {
  const [id, sig] = String(t || "").split(".");
  if (!id || !sig || !env("STATE_SECRET")) return null;
  return (await hmac("baja." + id)) === sig ? id : null;
}

/* Arma el email del día; null si no hay nada útil que decir */
export async function buildEmail(r: Row, now = new Date(), force = false) {
  const tz = r.tz || "America/Montevideo", today = localParts(now, tz).date, kinds = String(r.kinds || "");
  const blocks = (r.blocks || []).filter((b) => b && b.start && new Date(b.start).getTime() > now.getTime() && localParts(new Date(b.start), tz).date === today);
  const reviews = kinds.includes("repasos") ? Math.max(0, Number(r.reviews) || 0) : 0;
  const idle = r.last_active ? Math.floor((now.getTime() - new Date(r.last_active).getTime()) / 864e5) : 0;
  const lines: string[] = [];
  let subject = "";
  if (kinds.includes("sesiones") && blocks.length) {
    subject = `Hoy tenés ${blocks.length} bloque${blocks.length > 1 ? "s" : ""} de estudio`;
    lines.push(`<p>Tu plan de hoy:</p><ul>${blocks.slice(0, 6).map((b) => `<li><b>${hhmm(b.start, tz)}</b> · ${esc(b.topic)} <span style="color:#666">(${esc(b.subject)}${b.review ? ", repaso" : ""})</span></li>`).join("")}</ul>`);
  }
  if (reviews) {
    if (!subject) subject = `Tenés ${reviews} repaso${reviews > 1 ? "s" : ""} pendiente${reviews > 1 ? "s" : ""}`;
    lines.push(`<p>Tenés <b>${reviews} repaso${reviews > 1 ? "s" : ""}</b> de temas que fallaste. Hacerlos a tiempo es lo que más ayuda a recordar.</p>`);
  }
  if (kinds.includes("inactividad") && idle >= 2) {
    if (!subject) subject = "¿Retomamos? Tu plan de estudio te espera";
    lines.push(`<p>Hace ${idle} días que no completás un bloque. Con uno de 45 minutos hoy ya volvés a ritmo.</p>`);
  }
  if (!lines.length) {
    if (!force) return null;
    subject = "Así se ven tus recordatorios de Aulario";
    lines.push("<p>Todo en orden: hoy no tenés bloques ni repasos pendientes. Cuando los tengas, te avisamos a esta hora.</p>");
  }
  const baja = SB() + "/functions/v1/recordatorios?baja=" + enc(await unsubToken(r.auth_id));
  const hola = r.name ? `Hola, ${esc(String(r.name).split(" ")[0])}:` : "Hola:";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d2b;max-width:520px">
<p>${hola}</p>${lines.join("")}
<p><a href="${esc(site())}" style="display:inline-block;background:#1d1d2b;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Abrir Aulario</a></p>
<p style="color:#888;font-size:12px">Recibís este email porque activaste los recordatorios en Aulario. <a href="${esc(baja)}">No quiero recibir más recordatorios</a>.</p></div>`;
  return { subject, html, baja };
}

export async function sendMail(to: string, subject: string, html: string, baja: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM"), to: [to], subject, html, headers: { "List-Unsubscribe": `<${baja}>` } }),
  });
  if (!r.ok) throw new Error("mail " + r.status + " " + (await r.text()).slice(0, 200));
}

const page = (msg: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aulario</title><body style="font-family:Arial,sans-serif;padding:32px;max-width:480px;margin:auto"><h2>Aulario</h2><p>${msg}</p><p><a href="${esc(site())}">Volver a Aulario</a></p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });

export async function handleRecordatorios(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  // Baja desde el link del email
  if (req.method === "GET") {
    const id = await readUnsub(u.searchParams.get("baja") || "");
    if (!id) return page("Ese link no es válido.");
    await db("reminders?auth_id=eq." + enc(id), { method: "PATCH", prefer: "return=minimal", body: { enabled: false, updated_at: new Date().toISOString() } });
    return page("Listo: no te vamos a mandar más recordatorios. Podés volver a activarlos desde Mi perfil.");
  }
  // Corrida programada (cada hora)
  const secret = req.headers.get("x-cron-secret") || "";
  if (secret) {
    if (!env("CRON_SECRET") || secret !== env("CRON_SECRET")) return json({ error: "forbidden" }, 403);
    const now = new Date();
    const rows: Row[] = (await db("reminders?select=*&enabled=eq.true&limit=5000")) || [];
    let sent = 0, failed = 0;
    for (const r of rows) {
      const lp = localParts(now, r.tz || "America/Montevideo");
      if (lp.hour !== Number(r.hour) || r.last_sent_date === lp.date || !String(r.days ?? "0123456").includes(String(lp.weekday))) continue;
      try {
        const m = await buildEmail(r, now);
        if (!m) continue;
        await sendMail(r.email, m.subject, m.html, m.baja);
        await db("reminders?auth_id=eq." + enc(r.auth_id), { method: "PATCH", prefer: "return=minimal", body: { last_sent_date: lp.date } });
        sent++;
      } catch (e) { console.error(e); failed++; }
    }
    return json({ ok: true, sent, failed });
  }
  // Email de prueba, pedido por la persona desde Mi perfil
  const user = await authUser(req);
  if (!user) return json({ error: "no_session" }, 401);
  const r: Row | null = ((await db("reminders?select=*&auth_id=eq." + enc(user.id))) || [])[0] || null;
  const row: Row = r || { auth_id: user.id, email: user.email, enabled: true, hour: 18, days: "0123456", tz: "America/Montevideo", kinds: "sesiones,repasos,inactividad", name: null, blocks: [], reviews: 0, last_active: null, last_sent_date: null };
  try {
    const m = (await buildEmail({ ...row, email: user.email }, new Date(), true))!;
    await sendMail(user.email, m.subject, m.html, m.baja);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "mail" }, 502);
  }
}
