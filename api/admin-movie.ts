import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData, checkAdminPassword } from "../lib/telegramAuth";
import { supabase } from "../lib/supabase";

function movieFields(b: any) {
  return {
    title: b.title,
    original_title: b.original_title || null,
    poster_url: b.poster_url,
    release_year: b.release_year ? Number(b.release_year) : null,
    imdb_rating: b.imdb_rating ? Number(b.imdb_rating) : null,
    country: b.country || null,
    director: b.director || null,
    actors: b.actors || null,
    runtime_minutes: b.runtime_minutes ? Number(b.runtime_minutes) : null,
    short_description: b.short_description || null,
    mito_review: b.mito_review || null,
    trailer_url: b.trailer_url || null,
    official_watch_url: b.official_watch_url,
    recommended_day: b.recommended_day || null,
    recommended_time: b.recommended_time || null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId = requireAdminFromInitData(initData);
  if (!adminId) {
    res.status(401).json({ error: "Bu bölmə yalnız admin üçündür." });
    return;
  }
  if (!checkAdminPassword(req.headers["x-admin-password"])) {
    res.status(401).json({ error: "Şifrə səhvdir." });
    return;
  }

  if (req.method === "GET") {
    const planId = req.query.plan_id as string;
    if (!planId) {
      res.status(400).json({ error: "plan_id yoxdur" });
      return;
    }
    const { data } = await supabase
      .from("plan_movies")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });
    res.status(200).json({ movies: data || [] });
    return;
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.plan_id || !b.title || !b.poster_url || !b.official_watch_url) {
      res.status(400).json({ error: "Bütün məcburi sahələri doldur." });
      return;
    }
    const { data, error } = await supabase
      .from("plan_movies")
      .insert({ plan_id: b.plan_id, ...movieFields(b) })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ movie: data });
    return;
  }

  if (req.method === "PUT") {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "id yoxdur" });
      return;
    }
    const b = req.body || {};
    const { data, error } = await supabase
      .from("plan_movies")
      .update(movieFields(b))
      .eq("id", id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ movie: data });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "id yoxdur" });
      return;
    }
    const { error } = await supabase.from("plan_movies").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
