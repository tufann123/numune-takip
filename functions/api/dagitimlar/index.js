import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM dagitimlar ORDER BY dagitim_tarihi DESC, created_at DESC")
    .all();

  return json({ dagitimlar: results });
}

export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const body = await context.request.json().catch(() => null);
  if (!body || !body.numune_id || !body.dagitim_tarihi || !body.tip || !body.kime) {
    return json({ error: "Tarih, tip ve kime verildiği alanları zorunludur." }, 400);
  }
  if (!["uretim", "fason"].includes(body.tip)) {
    return json({ error: "Geçersiz tip." }, 400);
  }

  const id = newId();
  await context.env.DB
    .prepare(
      `INSERT INTO dagitimlar
        (id, numune_id, dagitim_tarihi, tip, kime, miktar, not_, olusturan_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.numune_id,
      body.dagitim_tarihi,
      body.tip,
      body.kime,
      body.miktar || null,
      body.not || null,
      user.email
    )
    .run();

  return json({ id }, 201);
}
