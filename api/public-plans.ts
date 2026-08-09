import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGenres, supabase } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const genres = await getGenres();

    const { data: plans } = await supabase
      .from("plans")
      .select("*, genres(name_az)")
      .eq("status", "published")
      .order("created_at", { ascending: true });

    const planIds = (plans || []).map((p: any) => p.id);

    let counts: Record<string, number> = {};
    let teaser: { title: string; poster: string }[] = [];

    if (planIds.length > 0) {
      const { data: movieRows } = await supabase
        .from("plan_movies")
        .select("plan_id, title, poster_url")
        .in("plan_id", planIds);

      (movieRows || []).forEach((m: any) => {
        counts[m.plan_id] = (counts[m.plan_id] || 0) + 1;
      });

      teaser = (movieRows || []).slice(0, 10).map((m: any) => ({ title: m.title, poster: m.poster_url }));
    }

    res.status(200).json({
      genres,
      plans: (plans || []).map((p: any) => ({
        id: p.id,
        genre_id: p.genre_id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        movieCount: counts[p.id] || 0,
      })),
      teaser,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "xəta" });
  }
}
