// Lógica de cobros de Nexus con Mercado Pago (Marketplace + suscripciones).
// Sin dependencias: solo fetch y Web Crypto, para que corra en Supabase Edge Functions (Deno).
//
// Variables de entorno (supabase secrets set ...):
//   MP_ACCESS_TOKEN    access token de producción de TU cuenta de Mercado Pago (cobra suscripciones y recibe comisiones)
//   MP_CLIENT_ID       client id de tu aplicación de Mercado Pago (para conectar cuentas de vendedores)
//   MP_CLIENT_SECRET   client secret de esa aplicación
//   SITE_URL           dirección pública de Nexus, por ejemplo https://nexus.netlify.app/
//   STATE_SECRET       una frase larga al azar (firma el pedido de conexión de Mercado Pago)
//   COMISION           opcional, por defecto 0.10 (10 %)
//   SUB_PRECIO         opcional, por defecto 400
//   SUB_MONEDA         opcional, por defecto UYU
//   PRUEBA_DIAS        opcional, por defecto 7 (días gratis desde que se suscribe; el primer cobro es al terminar)
//   (La suscripción se cobra con MP_ACCESS_TOKEN: el dinero va directo a esa cuenta de Mercado Pago.)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solo.

type Json = Record<string, any>;
type User = { id: string; email: string; created_at: string };

export const env = (k: string, d = ""): string => {
  const g = globalThis as any;
  return (g.Deno?.env?.get(k) ?? d) || d;
};
const num = (k: string, d: number) => {
  const v = parseFloat(env(k, ""));
  return Number.isFinite(v) ? v : d;
};
export const cfg = () => ({
  comision: num("COMISION", 0.1),
  precio: num("SUB_PRECIO", 400),
  moneda: env("SUB_MONEDA", "UYU"),
  prueba: num("PRUEBA_DIAS", 7),
  site: env("SITE_URL").replace(/\/?$/, "/"),
});

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });
export const round2 = (x: number) => Math.round(x * 100) / 100;

export const SB = () => env("SUPABASE_URL").replace(/\/+$/, "");
const SR = () => env("SUPABASE_SERVICE_ROLE_KEY");
const enc = encodeURIComponent;

/* ---------- Supabase (como service role) ---------- */
export async function db(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<any> {
  const r = await fetch(SB() + "/rest/v1/" + path, {
    method: init.method || "GET",
    headers: {
      apikey: SR(), Authorization: "Bearer " + SR(), "content-type": "application/json",
      Prefer: init.prefer || "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()).slice(0, 300));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const one = async (path: string) => ((await db(path)) || [])[0] || null;

export async function authUser(req: Request): Promise<User | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const r = await fetch(SB() + "/auth/v1/user", { headers: { apikey: SR(), Authorization: "Bearer " + t } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

/* ---------- Mercado Pago ---------- */
const MP = "https://api.mercadopago.com";
async function mp(path: string, token: string, init: { method?: string; body?: unknown; idem?: string } = {}): Promise<any> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  if (init.idem) h["X-Idempotency-Key"] = init.idem;
  const r = await fetch(MP + path, { method: init.method || "GET", headers: h, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const t = await r.text();
  if (!r.ok) throw new Error("mp " + r.status + " " + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* Firma del "state" de OAuth: id.timestamp.firma (vence en 1 hora) */
export async function hmac(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function makeState(id: string, now = Date.now()) {
  const base = id + "." + now;
  return base + "." + (await hmac(base));
}
export async function readState(state: string, now = Date.now()): Promise<string | null> {
  const [id, ts, sig] = String(state || "").split(".");
  if (!id || !ts || !sig || !env("STATE_SECRET")) return null;
  if (now - Number(ts) > 3600e3 || (await hmac(id + "." + ts)) !== sig) return null;
  return id;
}

const redirectUri = () => SB() + "/functions/v1/mp-oauth";

async function saveSeller(authId: string, t: Json) {
  await db("sellers?on_conflict=auth_id", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      auth_id: authId, mp_user_id: String(t.user_id || ""), access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + (Number(t.expires_in) || 15552000) * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
  });
}
/* Token de Mercado Pago de quien vende (lo renueva si está por vencer) */
async function sellerToken(authId: string): Promise<string | null> {
  const s = await one("sellers?select=*&auth_id=eq." + enc(authId));
  if (!s || !s.access_token) return null;
  if (s.expires_at && new Date(s.expires_at).getTime() < Date.now() + 24 * 3600e3 && s.refresh_token) {
    try {
      const t = await mp("/oauth/token", "", {
        method: "POST",
        body: { client_id: env("MP_CLIENT_ID"), client_secret: env("MP_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: s.refresh_token },
      });
      await saveSeller(authId, t);
      return t.access_token;
    } catch (_) { /* si falla la renovación, se intenta con el token actual */ }
  }
  return s.access_token;
}

/* ---------- Suscripción ---------- */
/* Para usar la app hay que suscribirse. La primera suscripción trae una semana gratis:
   se carga el medio de pago en Mercado Pago y el primer cobro es a los PRUEBA_DIAS días. */
async function subStatus(u: User) {
  const sub = await one("subscriptions?select=*&auth_id=eq." + enc(u.id));
  const now = Date.now();
  const paidUntil = sub && sub.paid_until ? new Date(sub.paid_until).getTime() : 0;
  const auto = !!sub && sub.status === "authorized";
  const te = sub && sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
  return {
    trial_available: !sub || !sub.trial_used,
    trial_ends_at: te ? new Date(te).toISOString() : null,
    in_trial: auto && te > now,
    subscription: sub ? { status: sub.status, next_payment_date: sub.next_payment_date, paid_until: sub.paid_until || null } : null,
    active: auto || paidUntil > now,
  };
}
async function syncPreapproval(id: string) {
  const p = await mp("/preapproval/" + enc(id), env("MP_ACCESS_TOKEN"));
  if (!p || !p.external_reference) return;
  await db("subscriptions?on_conflict=auth_id", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      auth_id: p.external_reference, email: p.payer_email || null, status: p.status, mp_preapproval_id: String(p.id),
      next_payment_date: p.next_payment_date || null, updated_at: new Date().toISOString(),
      // La semana gratis se usa una sola vez: cuenta desde que Mercado Pago autoriza la suscripción.
      ...(p.status === "authorized" ? { trial_used: true } : {}),
    },
  });
}

/* ---------- Función "pagos": la llama la página con la sesión de la persona ---------- */
export async function handlePagos(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const u = await authUser(req);
  if (!u) return json({ error: "no_session" }, 401);
  let b: Json = {};
  try { b = await req.json(); } catch (_) { /* cuerpo vacío */ }
  const c = cfg();
  try {
    switch (b.action) {
      case "status": {
        const seller = await one("sellers?select=auth_id&auth_id=eq." + enc(u.id));
        return json({ ...(await subStatus(u)), seller_connected: !!seller, comision: c.comision, precio: c.precio, moneda: c.moneda, prueba: c.prueba });
      }
      case "subscribe": {
        const st = await subStatus(u);
        if (st.subscription && st.subscription.status === "authorized") return json({ already: true });
        // Primera vez: semana gratis y el primer cobro al terminarla. Si ya la usó: se cobra al terminar lo ya pagado (o enseguida).
        const paidUntil = st.subscription && st.subscription.paid_until ? new Date(st.subscription.paid_until).getTime() : 0;
        const trialEnd = st.trial_available ? Date.now() + c.prueba * 864e5 : 0;
        const start = new Date(Math.max(trialEnd, paidUntil, Date.now() + 10 * 60e3));
        const p = await mp("/preapproval", env("MP_ACCESS_TOKEN"), {
          method: "POST",
          body: {
            reason: "Suscripción mensual a Nexus", external_reference: u.id, payer_email: u.email,
            back_url: c.site + "?r=suscripcion", status: "pending",
            auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: c.precio, currency_id: c.moneda, start_date: start.toISOString() },
          },
        });
        await db("subscriptions?on_conflict=auth_id", {
          method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
          body: {
            auth_id: u.id, email: u.email, status: p.status || "pending", mp_preapproval_id: String(p.id), updated_at: new Date().toISOString(),
            ...(trialEnd ? { trial_ends_at: new Date(trialEnd).toISOString() } : {}),
          },
        });
        return json({ url: p.init_point, trial_ends_at: trialEnd ? new Date(trialEnd).toISOString() : null, first_charge: start.toISOString() });
      }
      case "cancel_subscription": {
        const sub = await one("subscriptions?select=*&auth_id=eq." + enc(u.id));
        if (!sub || !sub.mp_preapproval_id || sub.status === "cancelled") return json({ ok: true, nothing: true });
        // Lo ya pagado se respeta: sigue con acceso hasta la fecha del próximo cobro, que ya no se hace.
        const keep = [sub.paid_until, sub.status === "authorized" ? sub.next_payment_date : null]
          .map((d) => (d ? new Date(d).getTime() : 0)).reduce((a, b) => Math.max(a, b), 0);
        await mp("/preapproval/" + enc(sub.mp_preapproval_id), env("MP_ACCESS_TOKEN"), { method: "PUT", body: { status: "cancelled" } });
        await syncPreapproval(sub.mp_preapproval_id);
        if (keep > Date.now()) await db("subscriptions?auth_id=eq." + enc(u.id), { method: "PATCH", prefer: "return=minimal", body: { paid_until: new Date(keep).toISOString() } });
        return json({ ok: true, access_until: keep > Date.now() ? new Date(keep).toISOString() : null });
      }
      case "pay_month": {
        // Un mes por adelantado: tarjeta de crédito, débito o dinero en Mercado Pago (sin efectivo). Va a la cuenta de MP_ACCESS_TOKEN.
        const pref = await mp("/checkout/preferences", env("MP_ACCESS_TOKEN"), {
          method: "POST",
          body: {
            items: [{ id: "nexus-mes", title: "Nexus · 1 mes de suscripción", quantity: 1, unit_price: c.precio, currency_id: c.moneda }],
            external_reference: "sub|" + u.id,
            payer: { email: u.email },
            payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
            back_urls: { success: c.site + "?r=suscripcion", pending: c.site + "?r=suscripcion", failure: c.site + "?r=compra-error" },
            auto_return: "approved",
            notification_url: SB() + "/functions/v1/mp-webhook?kind=sub",
          },
        });
        return json({ url: pref.init_point });
      }
      case "connect": {
        const url = "https://auth.mercadopago.com/authorization?client_id=" + enc(env("MP_CLIENT_ID")) +
          "&response_type=code&platform_id=mp&state=" + enc(await makeState(u.id)) + "&redirect_uri=" + enc(redirectUri());
        return json({ url });
      }
      case "checkout": {
        const l = await one("listings?select=*&id=eq." + enc(String(b.listing_id || "")));
        if (!l || !l.active) return json({ error: "not_found" }, 404);
        if (l.owner_auth === u.id) return json({ error: "own_listing" }, 400);
        const price = round2(Number(l.price) || 0);
        if (!(price > 0)) return json({ error: "free" }, 400);
        const token = l.owner_auth ? await sellerToken(l.owner_auth) : null;
        if (!token) return json({ error: "seller_not_connected" }, 409);
        const pref = await mp("/checkout/preferences", token, {
          method: "POST",
          body: {
            items: [{ id: l.id, title: String(l.title).slice(0, 250), quantity: 1, unit_price: price, currency_id: l.currency || "UYU" }],
            marketplace_fee: round2(price * c.comision),
            // Tarjeta de crédito, débito o dinero en Mercado Pago; sin efectivo (tarda días y demoraría la entrega).
            payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
            external_reference: l.id + "|" + u.id,
            payer: { email: u.email },
            back_urls: { success: c.site + "?r=compra", pending: c.site + "?r=compra-pendiente", failure: c.site + "?r=compra-error" },
            auto_return: "approved",
            notification_url: SB() + "/functions/v1/mp-webhook?seller=" + enc(l.owner_auth),
          },
        });
        return json({ url: pref.init_point });
      }
      case "deliver": {
        const l = await one("listings?select=*&id=eq." + enc(String(b.listing_id || "")));
        if (!l) return json({ error: "not_found" }, 404);
        const owner = l.owner_auth === u.id, free = !(Number(l.price) > 0);
        const bought = owner || free || !!(await one("sales?select=id&status=eq.approved&listing_id=eq." + enc(l.id) + "&buyer_auth=eq." + enc(u.id)));
        if (!bought) return json({ error: "not_bought" }, 403);
        const p = await one("listing_private?select=*&listing_id=eq." + enc(l.id));
        let url: string | null = null;
        if (p && p.file_path) {
          const r = await fetch(SB() + "/storage/v1/object/sign/ventas/" + p.file_path.split("/").map(enc).join("/"), {
            method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "content-type": "application/json" },
            body: JSON.stringify({ expiresIn: 600 }),
          });
          if (r.ok) { const j = await r.json(); url = SB() + "/storage/v1" + (j.signedURL || j.signedUrl); }
        }
        return json({ url, file_name: p?.file_name || null, contact_kind: p?.contact_kind || null, contact: p?.contact || null });
      }
      case "delete_account": {
        // Derecho de supresión (Ley 18.331): se cancela la suscripción y se borran los datos de la persona.
        // Se conservan solo los registros de pagos (sales, sub_payments) que exigen las normas contables y fiscales.
        const sub = await one("subscriptions?select=*&auth_id=eq." + enc(u.id));
        if (sub && sub.mp_preapproval_id && sub.status !== "cancelled") {
          try { await mp("/preapproval/" + enc(sub.mp_preapproval_id), env("MP_ACCESS_TOKEN"), { method: "PUT", body: { status: "cancelled" } }); } catch (e) { console.error(e); }
        }
        const del = (path: string) => db(path, { method: "DELETE", prefer: "return=minimal" });
        await del("reminders?auth_id=eq." + enc(u.id));
        await del("listings?owner_auth=eq." + enc(u.id)); // listing_private se borra en cascada
        await del("sellers?auth_id=eq." + enc(u.id));
        await del("subscriptions?auth_id=eq." + enc(u.id));
        await del("legal_acceptances?auth_id=eq." + enc(u.id));
        // Perfil público, grupos a los que pertenece y sus mensajes (user_data se borra en cascada con la cuenta)
        for (const t of ["messages", "members", "students", "listing_events"]) await del(t + "?uid=eq." + enc(u.id));
        // Archivos que la persona subió para vender
        try {
          const st = SB() + "/storage/v1/object";
          const h = { apikey: SR(), Authorization: "Bearer " + SR(), "content-type": "application/json" };
          const lr = await fetch(st + "/list/ventas", { method: "POST", headers: h, body: JSON.stringify({ prefix: u.id + "/", limit: 1000 }) });
          const files = lr.ok ? await lr.json() : [];
          if (Array.isArray(files) && files.length) {
            await fetch(st + "/ventas", { method: "DELETE", headers: h, body: JSON.stringify({ prefixes: files.map((f: Json) => u.id + "/" + f.name) }) });
          }
        } catch (e) { console.error(e); }
        // Por último, la cuenta de acceso
        const dr = await fetch(SB() + "/auth/v1/admin/users/" + enc(u.id), { method: "DELETE", headers: { apikey: SR(), Authorization: "Bearer " + SR() } });
        if (!dr.ok && dr.status !== 404) throw new Error("auth delete " + dr.status);
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: "server", message: String((e as Error).message || e).slice(0, 200) }, 502);
  }
}

/* ---------- Función "mp-oauth": Mercado Pago vuelve acá cuando alguien conecta su cuenta para vender ---------- */
export async function handleOAuth(req: Request): Promise<Response> {
  const u = new URL(req.url), site = cfg().site;
  const back = (r: string) => new Response(null, { status: 302, headers: { Location: site + "?r=" + r } });
  const id = await readState(u.searchParams.get("state") || "");
  const code = u.searchParams.get("code");
  if (!id || !code) return back("mp-error");
  try {
    const t = await mp("/oauth/token", "", {
      method: "POST",
      body: { client_id: env("MP_CLIENT_ID"), client_secret: env("MP_CLIENT_SECRET"), grant_type: "authorization_code", code, redirect_uri: redirectUri() },
    });
    await saveSeller(id, t);
    return back("mp-ok");
  } catch (e) {
    console.error(e);
    return back("mp-error");
  }
}

/* ---------- Función "mp-webhook": avisos de pagos y suscripciones ---------- */
export async function handleWebhook(req: Request): Promise<Response> {
  const u = new URL(req.url);
  let b: Json = {};
  try { b = await req.json(); } catch (_) { /* Mercado Pago a veces manda solo la URL */ }
  const topic = String(b.type || b.topic || u.searchParams.get("type") || u.searchParams.get("topic") || "");
  const id = String((b.data && b.data.id) || u.searchParams.get("data.id") || u.searchParams.get("id") || "");
  if (!id) return json({ ok: true });
  const c = cfg();
  try {
    if (topic === "payment" && !u.searchParams.get("seller")) {
      // Pago de "1 mes" de suscripción, cobrado con la cuenta de Nexus.
      const p = await mp("/v1/payments/" + enc(id), env("MP_ACCESS_TOKEN"));
      const [k, authId] = String(p.external_reference || "").split("|");
      if (k !== "sub" || !authId) return json({ ok: true, ignored: "reference" });
      if (p.status !== "approved" || round2(Number(p.transaction_amount) || 0) + 0.01 < c.precio || (p.currency_id && p.currency_id !== c.moneda)) return json({ ok: true, ignored: "status" });
      // Cada pago suma un mes una sola vez, aunque Mercado Pago repita el aviso.
      const ins = await db("sub_payments?on_conflict=mp_payment_id", {
        method: "POST", prefer: "resolution=ignore-duplicates,return=representation",
        body: { mp_payment_id: String(p.id), auth_id: authId, amount: Number(p.transaction_amount), currency: p.currency_id || c.moneda },
      });
      if (!ins || !ins.length) return json({ ok: true, duplicate: true });
      const sub = await one("subscriptions?select=*&auth_id=eq." + enc(authId));
      let base = Date.now();
      if (sub && sub.paid_until) base = Math.max(base, new Date(sub.paid_until).getTime());
      const until = new Date(base); until.setMonth(until.getMonth() + 1);
      await db("subscriptions?on_conflict=auth_id", {
        method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: { auth_id: authId, email: p.payer?.email || sub?.email || null, status: sub?.status === "authorized" ? "authorized" : "paid", paid_until: until.toISOString(), updated_at: new Date().toISOString() },
      });
      return json({ ok: true });
    }
    if (topic === "payment") {
      const seller = u.searchParams.get("seller") || "";
      const token = seller ? await sellerToken(seller) : null;
      if (!token) return json({ ok: true, ignored: "seller" });
      // Se consulta el pago a Mercado Pago: el aviso en sí no se usa como prueba de nada.
      const p = await mp("/v1/payments/" + enc(id), token);
      const [listingId, buyer] = String(p.external_reference || "").split("|");
      const l = listingId ? await one("listings?select=id,owner_auth,price,currency&id=eq." + enc(listingId)) : null;
      if (!l || l.owner_auth !== seller || !buyer) return json({ ok: true, ignored: "reference" });
      const amount = round2(Number(p.transaction_amount) || 0);
      const okAmount = amount + 0.01 >= round2(Number(l.price) || 0);
      await db("sales?on_conflict=mp_payment_id", {
        method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          mp_payment_id: String(p.id), listing_id: l.id, buyer_auth: buyer, seller_auth: seller, amount,
          fee: round2(Number(p.marketplace_fee ?? amount * c.comision)), currency: p.currency_id || l.currency,
          status: okAmount ? p.status : "amount_mismatch", updated_at: new Date().toISOString(),
        },
      });
      return json({ ok: true });
    }
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      await syncPreapproval(id);
      return json({ ok: true });
    }
    if (topic === "subscription_authorized_payment") {
      const ap = await mp("/authorized_payments/" + enc(id), env("MP_ACCESS_TOKEN"));
      if (ap && ap.preapproval_id) await syncPreapproval(ap.preapproval_id);
      return json({ ok: true });
    }
    return json({ ok: true, ignored: topic });
  } catch (e) {
    console.error(e);
    // 500 para que Mercado Pago reintente más tarde.
    return json({ error: "server" }, 500);
  }
}
