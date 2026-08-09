import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase } from "../lib/supabase";

export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" },
  },
};

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

  try {
    const { imageBase64, filename, contentType } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: "Şəkil yoxdur" });
      return;
    }

    const base64Data = String(imageBase64).includes(",")
      ? String(imageBase64).split(",")[1]
      : String(imageBase64);
    const buffer = Buffer.from(base64Data, "base64");

    const ext = ((filename as string) || "image.jpg").split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("posters").upload(path, buffer, {
      contentType: contentType || "image/jpeg",
      upsert: false,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data } = supabase.storage.from("posters").getPublicUrl(path);
    res.status(200).json({ url: data.publicUrl });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Yükləmə xətası" });
  }
}
