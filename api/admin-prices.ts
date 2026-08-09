import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { setSetting } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId = requireAdminFromInitData(initData);
  if (!adminId) {
    res.status(401).json({ error: "Bu bölmə yalnız admin üçündür." });
    return;
  }

  const b = req.body || {};
  const entries: [string, any][] = [
    ["price_genre_day", b.price_genre_day],
    ["price_genre_week", b.price_genre_week],
    ["price_genre_month", b.price_genre_month],
    ["price_mixed_day", b.price_mixed_day],
    ["price_mixed_week", b.price_mixed_week],
    ["price_mixed_month", b.price_mixed_month],
    ["price_genre", b.price_genre],
    ["price_mixed", b.price_mixed],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      await setSetting(key, String(parseFloat(value).toFixed(2)));
    }
  }

  res.status(200).json({ ok: true });
}
