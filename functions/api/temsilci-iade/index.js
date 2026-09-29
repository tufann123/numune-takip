import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM temsilci_iade_talepleri ORDER BY created_at DESC")
    .all();

  return json({ temsilci_iadeleri: results });
}

// Herhangi bir giris yapmis kullanici (tipik olarak viewer / fason-uretim
// ekibi), elindeki bir numuneyi musteri temsilcisine iade ettigini bildirip
// editor onayina sunabilir.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  if (!body || !body.dagitim_id) {
    return json({ error: "dagitim_id zorunludur." }, 400);
  }

  const dagitim = await context.env.DB
    .prepare("SELECT id, iade_tarihi FROM dagitimlar WHERE id = ?")
    .bind(body.dagitim_id)
    .first();
  if (!dagitim) return json({ error: "Dağıtım kaydı bulunamadı." }, 404);
  if (dagitim.iade_tarihi) {
    return json({ error: "Bu dağıtım zaten iade edilmiş." }, 400);
  }

  const existing = await context.env.DB
    .prepare("SELECT id FROM temsilci_iade_talepleri WHERE dagitim_id = ? AND durum = 'bekliyor'")
    .bind(body.dagitim_id)
    .first();
  if (existing) {
    return json({ error: "Bu dağıtım için zaten bekleyen bir iade onayı var." }, 409);
  }

  const id = newId();
  await context.env.DB
    .prepare(
      `INSERT INTO temsilci_iade_talepleri (id, dagitim_id, talep_eden_email, talep_eden_ad, not_)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, body.dagitim_id, user.email, user.ad_soyad, body.not || null)
    .run();

  return json({ id }, 201);
}
