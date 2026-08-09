import { supabase, getLatestPublishedWeek } from "./supabase";

export type PlanDuration = "day" | "week" | "month";

// Veb saytdakı müddətli planlar üçün: janr (və ya qarışıq) + müddət seçiminə görə
// tövsiyə olunan filmləri qaytarır.
// - "day"   → ən son yayımlanan həftədən 1 seçilmiş film
// - "week"  → ən son yayımlanan həftənin bütün filmləri
// - "month" → son 31 gün ərzində yayımlanmış bütün həftələrin filmləri
export async function getMoviesForOrder(params: {
  genre_id: number | null;
  duration: PlanDuration;
}) {
  if (params.duration === "month") {
    const since = new Date();
    since.setDate(since.getDate() - 31);

    const { data: weeks } = await supabase
      .from("weeks")
      .select("id")
      .eq("status", "published")
      .gte("published_at", since.toISOString());

    const weekIds = (weeks || []).map((w) => w.id);
    if (weekIds.length === 0) return { label: fallbackLabel(params.genre_id), movies: [] };

    let q = supabase.from("movies").select("*, genres(name_az)").in("week_id", weekIds);
    if (params.genre_id) q = q.eq("genre_id", params.genre_id);
    const { data: movies } = await q.order("created_at", { ascending: false });

    return {
      label: params.genre_id
        ? (movies?.[0] as any)?.genres?.name_az || "Janr"
        : "Qarışıq",
      movies: movies || [],
    };
  }

  const week = await getLatestPublishedWeek();
  if (!week) return { label: fallbackLabel(params.genre_id), movies: [] };

  let q = supabase.from("movies").select("*, genres(name_az)").eq("week_id", week.id);
  if (params.genre_id) q = q.eq("genre_id", params.genre_id);
  if (params.duration === "day") q = q.order("created_at", { ascending: true }).limit(1);

  const { data: movies } = await q;

  return {
    label: params.genre_id ? (movies?.[0] as any)?.genres?.name_az || "Janr" : "Qarışıq",
    movies: movies || [],
  };
}

function fallbackLabel(genreId: number | null) {
  return genreId ? "Janr" : "Qarışıq";
}

