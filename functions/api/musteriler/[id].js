import { getUser, json } from "../../_lib.js";

export async function onRequestDelete(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  const existingRow = await context.env.DB
    .prepare("SELECT id FROM musteriler WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Müşteri bulunamadı." }, 404);

  await context.env.DB
    .prepare("DELETE FROM musteriler WHERE id = ?")
    .bind(id)
    .run();

  return json({ ok: true });
}
