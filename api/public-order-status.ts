import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../lib/supabase";
import { getMoviesForSubscription } from "../lib/movies";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || "";
  if (!id) {
    res.status(400).json({ status: "error", error: "id yoxdur" });
    return;
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, weeks(week_label)")
    .eq("id", id)
    .maybeSingle();

  if (!sub) {
    res.status(200).json({ status: "not_found" });
    return;
  }

  if (sub.status !== "paid") {
    res.status(200).json({ status: sub.status });
    return;
  }

  const { label, movies } = await getMoviesForSubscription(sub);

  res.status(200).json({
    status: "paid",
    label,
    weekLabel: (sub as any).weeks?.week_label || "",
    movies: movies.map((m: any) => ({
      title: m.title,
      year: m.release_year,
      imdb: m.imdb_rating,
      country: m.country,
      director: m.director,
      actors: m.actors,
      runtime: m.runtime_minutes,
      poster: m.poster_url,
      desc: m.short_description,
      review: m.mito_review,
      trailer: m.trailer_url,
      watch: m.official_watch_url,
    })),
  });
}
