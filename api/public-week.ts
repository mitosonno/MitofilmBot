import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLatestPublishedWeek, getGenres, getSetting, supabase } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const week = await getLatestPublishedWeek();
    if (!week) {
      res.status(200).json({ week: null });
      return;
    }

    const [genres, priceGenre, priceMixed, currency] = await Promise.all([
      getGenres(),
      getSetting("price_genre"),
      getSetting("price_mixed"),
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
      prices: {
        genre: priceGenre || "3.00",
        mixed: priceMixed || "5.00",
        currency: currency || "AZN",
      },
      teaser: (movies || []).map((m) => ({ title: m.title, poster: m.poster_url })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "xəta" });
  }
}
