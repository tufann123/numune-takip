import { getUser, json, newId } from "../../_lib.js";
import { notifyUser } from "../../_webpush.js";

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

  // Bu numune icin bekleyen bir talep varsa, dagitim yapildigi icin
  // otomatik olarak "tamamlandi" olarak isaretle.
  // (Bildirim icin bekleyen talepleri ve numune bilgisini onceden al.)
  const bekleyenler = await context.env.DB
    .prepare(
      `SELECT t.talep_eden_email, t.talep_eden_ad, n.numune_adi, n.musteri
       FROM talepler t
       LEFT JOIN numuneler n ON n.id = t.numune_id
       WHERE t.numune_id = ? AND t.durum = 'bekliyor'`
    )
    .bind(body.numune_id)
    .all();

  await context.env.DB
    .prepare(
      `UPDATE talepler
       SET durum = 'tamamlandi', tamamlanma_tarihi = datetime('now'), tamamlayan_email = ?
       WHERE numune_id = ? AND durum = 'bekliyor'`
    )
    .bind(user.email, body.numune_id)
    .run();

  // Talep eden hesaplara "numune hazir" bildirimi - basarisiz olursa yaniti etkilemesin.
  try {
    for (const t of bekleyenler.results || []) {
      if (!t.talep_eden_email) continue;
      const ad = t.numune_adi || "Talep ettiğiniz numune";
      await notifyUser(context.env, t.talep_eden_email, {
        title: "Numune hazır",
        body: `${ad}${t.musteri ? " (" + t.musteri + ")" : ""} hazırlandı ve ${body.kime} için dağıtıldı.${t.talep_eden_ad ? " Talep eden: " + t.talep_eden_ad : ""}`,
        url: "/",
      });
    }
  } catch (err) {
    // yoksay
  }

  return json({ id }, 201);
}
