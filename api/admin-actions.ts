import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase, setSetting } from "../lib/supabase";

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
  const action = b.action;

  if (action === "create_week") {
    if (!b.label || !String(b.label).trim()) {
      res.status(400).json({ error: "Həftə adı lazımdır." });
      return;
    }
    const { data, error } = await supabase
      .from("weeks")
      .insert({ week_label: String(b.label).trim(), status: "draft" })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ week: data });
    return;
  }

  if (action === "publish_week") {
    if (!b.week_id) {
      res.status(400).json({ error: "week_id yoxdur" });
      return;
    }
    const { error } = await supabase
      .from("weeks")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", b.week_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "update_prices") {
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
    return;
  }

  res.status(400).json({ error: "Naməlum əməliyyat" });
}
