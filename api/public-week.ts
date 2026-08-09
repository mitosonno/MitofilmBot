import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLatestPublishedWeek, getGenres, getSetting, supabase } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const week = await getLatestPublishedWeek();
    if (!week) {
      res.status(200).json({ week: null });
      return;
    }

    const [
      genres,
      priceGenreDay,
      priceGenreWeek,
      priceGenreMonth,
      priceMixedDay,
      priceMixedWeek,
      priceMixedMonth,
      currency,
    ] = await Promise.all([
      getGenres(),
      getSetting("price_genre_day"),
      getSetting("price_genre_week"),
      getSetting("price_genre_month"),
      getSetting("price_mixed_day"),
      getSetting("price_mixed_week"),
      getSetting("price_mixed_month"),
      getSetting("currency"),
    ]);

    const { data: movies } = await supabase
      .from("movies")
      .select("title, poster_url")
      .eq("week_id", week.id)
      .limit(10);

    res.status(200).json({
      week: { id: week.id, label: week.week_label },
      genres,
      currency: currency || "AZN",
      prices: {
        genre: {
          day: priceGenreDay || "1.00",
          week: priceGenreWeek || "3.00",
          month: priceGenreMonth || "8.00",
        },
        mixed: {
          day: priceMixedDay || "1.50",
          week: priceMixedWeek || "5.00",
          month: priceMixedMonth || "12.00",
        },
      },
      teaser: (movies || []).map((m) => ({ title: m.title, poster: m.poster_url })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "xəta" });
  }
}
