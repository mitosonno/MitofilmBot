import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase, getGenres, getDraftWeek, getSetting } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId = requireAdminFromInitData(initData);
  if (!adminId) {
    res.status(401).json({ error: "Bu bölmə yalnız admin üçündür." });
    return;
  }

  const [
    week,
    genres,
    priceGenreDay,
    priceGenreWeek,
    priceGenreMonth,
    priceMixedDay,
    priceMixedWeek,
    priceMixedMonth,
    botPriceGenre,
    botPriceMixed,
    currency,
  ] = await Promise.all([
    getDraftWeek(),
    getGenres(),
    getSetting("price_genre_day"),
    getSetting("price_genre_week"),
    getSetting("price_genre_month"),
    getSetting("price_mixed_day"),
    getSetting("price_mixed_week"),
    getSetting("price_mixed_month"),
    getSetting("price_genre"),
    getSetting("price_mixed"),
    getSetting("currency"),
  ]);

  let movies: any[] = [];
  if (week) {
    const { data } = await supabase
      .from("movies")
      .select("*, genres(name_az)")
      .eq("week_id", week.id)
      .order("created_at", { ascending: true });
    movies = data || [];
  }

  const { data: publishedWeeks } = await supabase
    .from("weeks")
    .select("id, week_label, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(8);

  res.status(200).json({
    week,
    movies,
    genres,
    publishedWeeks: publishedWeeks || [],
    prices: {
      site: {
        genre: { day: priceGenreDay, week: priceGenreWeek, month: priceGenreMonth },
        mixed: { day: priceMixedDay, week: priceMixedWeek, month: priceMixedMonth },
      },
      bot: { genre: botPriceGenre, mixed: botPriceMixed },
      currency: currency || "AZN",
    },
  });
}
