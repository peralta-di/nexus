// Funciones del servidor de Nexus. Nexus es gratuito y no procesa pagos.
// Sin dependencias: solo fetch y Web Crypto, para que corra en Supabase Edge Functions (Deno).
//
// Variables de entorno (supabase secrets set ...):
//   SITE_URL       dirección pública de Nexus, por ejemplo https://tu-usuario.github.io/nexus/
//   STATE_SECRET   una frase larga al azar (firma los links para darse de baja de los recordatorios)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase solo.

type Json = Record<string, any>;
type User = { id: string; email: string; created_at: string };

export const env = (k: string, d = ""): string => {
  const g = globalThis as any;
  return (g.Deno?.env?.get(k) ?? d) || d;
};

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

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

export async function authUser(req: Request): Promise<User | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const r = await fetch(SB() + "/auth/v1/user", { headers: { apikey: SR(), Authorization: "Bearer " + t } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

/* Firma HMAC (links de baja de los recordatorios) */
export async function hmac(s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- Función "cuenta": la llama la página con la sesión de la persona ---------- */
export async function handleCuenta(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const u = await authUser(req);
  if (!u) return json({ error: "no_session" }, 401);
  let b: Json = {};
  try { b = await req.json(); } catch (_) { /* cuerpo vacío */ }
  try {
    switch (b.action) {
      case "delete_account": {
        // Derecho de supresión (Ley 18.331): se borran todos los datos de la persona.
        const del = (path: string) => db(path, { method: "DELETE", prefer: "return=minimal" });
        await del("reminders?auth_id=eq." + enc(u.id));
        await del("listings?owner_auth=eq." + enc(u.id));
        await del("legal_acceptances?auth_id=eq." + enc(u.id));
        // Perfil público, grupos a los que pertenece y sus mensajes (user_data se borra en cascada con la cuenta)
        for (const t of ["messages", "members", "students", "listing_events"]) await del(t + "?uid=eq." + enc(u.id));
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
    return json({ error: "server" }, 500);
  }
}
