import { supabase } from "./supabase";
import { T } from "./texts";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendPhoto(chatId: number, photoUrl: string, caption: string) {
  await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

// Ödəniş təsdiqləndikdən sonra çağırılır: abunəliyi "paid" edir və filmləri göndərir.
export async function deliverMoviesForSubscription(subscriptionId: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, weeks(week_label)")
    .eq("id", subscriptionId)
    .single();

  if (!sub || sub.status === "paid") return; // artıq işlənib və ya tapılmadı

  await supabase
    .from("subscriptions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  let query = supabase.from("movies").select("*, genres(name_az)").eq("week_id", sub.week_id);
  if (sub.genre_id) query = query.eq("genre_id", sub.genre_id);
  const { data: movies } = await query;

  const label = sub.genre_id
    ? (movies?.[0] as any)?.genres?.name_az || "Janr"
    : "Qarışıq";

  await sendMessage(sub.user_id, T.paymentConfirmedHeader(label));

  if (!movies || movies.length === 0) {
    await sendMessage(sub.user_id, T.noMoviesYet);
    return;
  }

  for (const m of movies) {
    const caption = T.movieCard({
      title: m.title,
      year: m.release_year,
      imdb: m.imdb_rating,
      country: m.country,
      director: m.director,
      actors: m.actors,
      runtime: m.runtime_minutes,
      desc: m.short_description,
      review: m.mito_review,
      trailer: m.trailer_url,
      watch: m.official_watch_url,
    });
    await sendPhoto(sub.user_id, m.poster_url, caption);
  }
}
