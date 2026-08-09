import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, getLatestPublishedWeek, getSetting } from "../lib/supabase";
import { createPayriffOrder } from "../lib/payriff";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const genreId: number | null = body.genreId ? Number(body.genreId) : null;
    const duration: "day" | "week" | "month" = ["day", "week", "month"].includes(body.duration)
      ? body.duration
      : "week";

    const week = await getLatestPublishedWeek();
    if (!week) {
      res.status(400).json({ error: "Bu həftə üçün hələ tövsiyə açılmayıb." });
      return;
    }

    const settingKey = `price_${genreId ? "genre" : "mixed"}_${duration}`;
    const priceStr = (await getSetting(settingKey)) || "0";
    const amount = parseFloat(priceStr);
    const currency = (await getSetting("currency")) || "AZN";

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: null,
        week_id: week.id,
        genre_id: genreId,
        duration,
        status: "pending",
        amount,
        currency,
        source: "web",
      })
      .select()
      .single();

    if (error || !sub) {
      res.status(500).json({ error: "Sifariş yaradıla bilmədi." });
      return;
    }

    const base = process.env.PUBLIC_BASE_URL || "";
    const result = await createPayriffOrder({
      orderId: sub.id,
      amount,
      description: `MitoFilm — ${duration === "day" ? "1 günlük" : duration === "month" ? "1 aylıq" : "7 günlük"} tövsiyə`,
      approveUrl: `${base}/result.html?order=${sub.id}`,
      cancelUrl: `${base}/result.html?order=${sub.id}&cancelled=1`,
      declineUrl: `${base}/result.html?order=${sub.id}&declined=1`,
    });

    if (!result.ok) {
      res.status(500).json({ error: result.error });
      return;
    }

    await supabase
      .from("subscriptions")
      .update({ payriff_order_id: result.payriffOrderId })
      .eq("id", sub.id);

    res.status(200).json({ paymentUrl: result.paymentUrl, orderId: sub.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "xəta" });
  }
}
