import { getUser, json } from "../../_lib.js";

export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  const existingRow = await context.env.DB
    .prepare("SELECT id FROM dagitimlar WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Dağıtım kaydı bulunamadı." }, 404);

  const body = await context.request.json().catch(() => null);
  const iade_tarihi = (body?.iade_tarihi || "").trim();
  const iade_notu = (body?.iade_notu || "").trim();

  if (!iade_tarihi) {
    return json({ error: "İade tarihi zorunludur." }, 400);
  }

  await context.env.DB
    .prepare("UPDATE dagitimlar SET iade_tarihi = ?, iade_notu = ? WHERE id = ?")
    .bind(iade_tarihi, iade_notu || null, id)
    .run();

  return json({ ok: true });
}
