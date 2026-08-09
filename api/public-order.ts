import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../lib/supabase";
import { createPayriffOrder } from "../lib/payriff";
import { getMoviesForPlan } from "../lib/movies";
import { deliverMoviesForSubscription } from "../lib/deliver";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const id = (req.query.id as string) || "";
    if (!id) {
      res.status(400).json({ status: "error", error: "id yoxdur" });
      return;
    }

    const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).maybeSingle();

    if (!sub) {
      res.status(200).json({ status: "not_found" });
      return;
    }
    if (sub.status !== "paid") {
      res.status(200).json({ status: sub.status });
      return;
    }

    const { label, planTitle, movies } = await getMoviesForPlan(sub.plan_id);

    res.status(200).json({
      status: "paid",
      label,
      weekLabel: planTitle,
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
        day: m.recommended_day,
        time: m.recommended_time,
      })),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const planId = body.planId as string;
    const telegramUserId: number | null = body.telegramUserId ? Number(body.telegramUserId) : null;
    const promoCodeInput: string | null = body.promoCode ? String(body.promoCode).trim().toUpperCase() : null;

    if (!planId) {
      res.status(400).json({ error: "planId yoxdur" });
      return;
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("status", "published")
      .maybeSingle();

    if (!plan) {
      res.status(400).json({ error: "Bu plan artıq mövcud deyil." });
      return;
    }

    let amount = Number(plan.price);
    let promo: any = null;

    if (promoCodeInput) {
      const { data: foundPromo } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoCodeInput)
        .eq("is_active", true)
        .maybeSingle();

      if (!foundPromo) {
        res.status(400).json({ error: "Promo kod tapılmadı və ya aktiv deyil." });
        return;
      }
      if (foundPromo.expires_at && new Date(foundPromo.expires_at) < new Date()) {
        res.status(400).json({ error: "Promo kodun vaxtı bitib." });
        return;
      }
      if (foundPromo.max_uses !== null && foundPromo.used_count >= foundPromo.max_uses) {
        res.status(400).json({ error: "Promo kodun limiti bitib." });
        return;
      }

      promo = foundPromo;
      amount = Math.max(0, Math.round(plan.price * (1 - promo.discount_percent / 100) * 100) / 100);
    }

    if (telegramUserId) {
      await supabase.from("users").upsert({ id: telegramUserId });
    }

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: telegramUserId,
        plan_id: plan.id,
        genre_id: plan.genre_id,
        status: "pending",
        amount,
        currency: plan.currency,
        source: telegramUserId ? "miniapp" : "web",
        promo_code: promo ? promo.code : null,
      })
      .select()
      .single();

    if (error || !sub) {
      res.status(500).json({ error: "Sifariş yaradıla bilmədi." });
      return;
    }

    // Promo kod qiyməti sıfıra endiribsə, Payriff-ə ehtiyac yoxdur — birbaşa çatdırırıq
    if (amount <= 0) {
      if (promo) {
        await supabase.from("promo_codes").update({ used_count: promo.used_count + 1 }).eq("id", promo.id);
      }
      await deliverMoviesForSubscription(sub.id);
      res.status(200).json({ free: true, orderId: sub.id });
      return;
    }

    const base = process.env.PUBLIC_BASE_URL || "";
    const result = await createPayriffOrder({
      orderId: sub.id,
      amount,
      description: `MitoFilm — ${plan.title}`,
      approveUrl: `${base}/result.html?order=${sub.id}`,
      cancelUrl: `${base}/result.html?order=${sub.id}&cancelled=1`,
      declineUrl: `${base}/result.html?order=${sub.id}&declined=1`,
    });

    if (!result.ok) {
      res.status(500).json({ error: result.error });
      return;
    }

    if (promo) {
      await supabase.from("promo_codes").update({ used_count: promo.used_count + 1 }).eq("id", promo.id);
    }

    await supabase
      .from("subscriptions")
      .update({ payriff_order_id: result.payriffOrderId })
      .eq("id", sub.id);

    res.status(200).json({ paymentUrl: result.paymentUrl, orderId: sub.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "xəta" });
  }
}
