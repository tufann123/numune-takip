import { getUser, json } from "../../_lib.js";

export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;
  const body = await context.request.json().catch(() => null);
  const yeniAd = (body?.ad || "").trim();
  if (!yeniAd) return json({ error: "İsim zorunludur." }, 400);

  const existingRow = await context.env.DB
    .prepare("SELECT id FROM talep_eden_kisiler WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Kişi bulunamadı." }, 404);

  const conflict = await context.env.DB
    .prepare("SELECT id FROM talep_eden_kisiler WHERE ad = ? COLLATE NOCASE AND id != ?")
    .bind(yeniAd, id)
    .first();
  if (conflict) return json({ error: "Bu isimde bir kişi zaten var." }, 409);

  await context.env.DB
    .prepare("UPDATE talep_eden_kisiler SET ad = ? WHERE id = ?")
    .bind(yeniAd, id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  const existingRow = await context.env.DB
    .prepare("SELECT id FROM talep_eden_kisiler WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Kişi bulunamadı." }, 404);

  await context.env.DB
    .prepare("DELETE FROM talep_eden_kisiler WHERE id = ?")
    .bind(id)
    .run();

  return json({ ok: true });
}
