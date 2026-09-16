import { getUser, json } from "../../../_lib.js";

// Bir talebi elle "tamamlandi" isaretlemek icin (editor'un dagitim eklemeden
// de bir talebi kapatabilmesi icin, orn. ekiple sozlu konusulduysa).
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  await context.env.DB
    .prepare(
      `UPDATE talepler
       SET durum = 'tamamlandi', tamamlanma_tarihi = datetime('now'), tamamlayan_email = ?
       WHERE id = ? AND durum = 'bekliyor'`
    )
    .bind(user.email, id)
    .run();

  return json({ ok: true });
}
