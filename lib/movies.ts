import { supabase } from "./supabase";

export async function getMoviesForSubscription(sub: {
  week_id: string;
  genre_id: number | null;
}) {
  let query = supabase
    .from("movies")
    .select("*, genres(name_az)")
    .eq("week_id", sub.week_id);
  if (sub.genre_id) query = query.eq("genre_id", sub.genre_id);
  const { data: movies } = await query;

  const label = sub.genre_id
    ? (movies?.[0] as any)?.genres?.name_az || "Janr"
    : "Qarışıq";

  return { label, movies: movies || [] };
}
