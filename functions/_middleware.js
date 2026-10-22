// Baska sitelerden gelen degistirme isteklerini (POST/PUT/PATCH/DELETE) reddeder (CSRF korumasi).
export async function onRequest(context) {
const req = context.request;
if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
let ok = false;
try { ok = new URL(req.headers.get("Origin") || "").host === new URL(req.url).host; } catch (e) { ok = false; }
if (!ok) return new Response(JSON.stringify({ error: "Geçersiz istek kaynağı." }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
}
return context.next();
}
