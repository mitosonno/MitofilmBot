import { supabase } from "./supabase";
import { T } from "./texts";
import { getMoviesForOrder } from "./movies";
import { sendReceiptEmail } from "./email";

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

function durationLabel(duration: string) {
  return duration === "day" ? "1 günlük" : duration === "month" ? "1 aylıq" : "7 günlük";
}

// Ödəniş təsdiqləndikdən sonra çağırılır: abunəliyi "paid" edir, filmləri
// müəyyənləşdirir, və mövcud kanallara görə çatdırır:
// - Telegram-dan gələn (və ya Mini App-dan Telegram istifadəçisi kimi gələn) sifarişlərə → bot mesajı
// - email-i olan istifadəçilərə → qəbz + tövsiyələr email-i
export async function deliverMoviesForSubscription(subscriptionId: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();

  if (!sub || sub.status === "paid") return; // artıq işlənib və ya tapılmadı

  await supabase
    .from("subscriptions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  const { label, movies } = await getMoviesForOrder({
    genre_id: sub.genre_id,
    duration: sub.duration || "week",
  });

  const planLabel = `${label} — ${durationLabel(sub.duration || "week")}`;

  if (sub.user_id) {
    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("id", sub.user_id)
      .maybeSingle();

    if (user?.email) {
      await sendReceiptEmail({
        to: user.email,
        planLabel,
        amount: sub.amount,
        currency: sub.currency,
        movies: movies.map((m: any) => ({
          title: m.title,
          poster: m.poster_url,
          watch: m.official_watch_url,
          desc: m.short_description,
        })),
      });
    }

    await sendMessage(sub.user_id, T.paymentConfirmedHeader(label));

    if (movies.length === 0) {
      await sendMessage(sub.user_id, T.noMoviesYet);
    } else {
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
  }
  // sub.user_id olmayan (tam anonim, brauzerdən) sifarişlər üçün nəticə
  // yalnız veb saytın öz nəticə səhifəsində göstərilir (əlavə iş lazım deyil).
}
