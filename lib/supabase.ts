import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export type Genre = { id: number; name_az: string };

export type Week = {
  id: string;
  week_label: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  published_at: string | null;
};

export type Movie = {
  id: string;
  week_id: string;
  genre_id: number;
  title: string;
  original_title: string | null;
  poster_url: string;
  release_year: number | null;
  imdb_rating: number | null;
  country: string | null;
  director: string | null;
  actors: string | null;
  runtime_minutes: number | null;
  short_description: string | null;
  mito_review: string | null;
  trailer_url: string | null;
  official_watch_url: string;
};

export type Subscription = {
  id: string;
  user_id: number | null;
  week_id: string;
  genre_id: number | null;
  status: "pending" | "paid" | "failed" | "cancelled";
  amount: number;
  currency: string;
  payriff_order_id: string | null;
  source: "telegram" | "web";
};

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await supabase.from("settings").upsert({ key, value });
}

export async function getGenres(): Promise<Genre[]> {
  const { data } = await supabase.from("genres").select("*").order("name_az");
  return data ?? [];
}

export async function getDraftWeek(): Promise<Week | null> {
  const { data } = await supabase
    .from("weeks")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getLatestPublishedWeek(): Promise<Week | null> {
  const { data } = await supabase
    .from("weeks")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function upsertUser(u: {
  id: number;
  username?: string;
  first_name?: string;
}) {
  await supabase.from("users").upsert({
    id: u.id,
    username: u.username ?? null,
    first_name: u.first_name ?? null,
  });
}

export async function getAdminSession(adminId: number): Promise<any> {
  const { data } = await supabase
    .from("admin_sessions")
    .select("state")
    .eq("admin_id", adminId)
    .maybeSingle();
  return data?.state ?? null;
}

export async function setAdminSession(adminId: number, state: any) {
  await supabase
    .from("admin_sessions")
    .upsert({ admin_id: adminId, state, updated_at: new Date().toISOString() });
}

export async function clearAdminSession(adminId: number) {
  await supabase.from("admin_sessions").delete().eq("admin_id", adminId);
}
