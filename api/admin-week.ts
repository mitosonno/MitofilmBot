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

  const { label } = req.body || {};
  if (!label || !String(label).trim()) {
    res.status(400).json({ error: "Həftə adı lazımdır." });
    return;
  }

  const { data, error } = await supabase
    .from("weeks")
    .insert({ week_label: String(label).trim(), status: "draft" })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ week: data });
}
