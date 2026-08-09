import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const telegramUserId = req.query.telegramUserId ? Number(req.query.telegramUserId) : null;
  if (!telegramUserId) {
    res.status(400).json({ error: "telegramUserId yoxdur" });
    return;
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, genre_id, duration, status, amount, currency, created_at, paid_at, genres(name_az)")
    .eq("user_id", telegramUserId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(30);

  res.status(200).json({
    orders: (subs || []).map((s: any) => ({
      id: s.id,
      label: s.genre_id ? s.genres?.name_az || "Janr" : "Qarışıq",
      duration: s.duration,
      amount: s.amount,
      currency: s.currency,
      paidAt: s.paid_at,
    })),
  });
}
