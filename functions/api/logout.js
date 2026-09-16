import { json, clearSessionCookieHeader } from "../_lib.js";

export async function onRequestPost(context) {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}
