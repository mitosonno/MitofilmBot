import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase } from "../lib/supabase";

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

  const { week_id } = req.body || {};
  if (!week_id) {
    res.status(400).json({ error: "week_id yoxdur" });
    return;
  }

  const { error } = await supabase
    .from("weeks")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", week_id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
