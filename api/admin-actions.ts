import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase, setSetting } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId = requireAdminFromInitData(initData);
  if (!adminId) {
    res.status(401).json({ error: "Bu bölmə yalnız admin üçündür." });
    return;
  }

  const b = req.body || {};
  const action = b.action;

  if (action === "create_plan") {
    if (!b.title || !String(b.title).trim() || b.price === undefined || b.price === "") {
      res.status(400).json({ error: "Ad və qiymət lazımdır." });
      return;
    }
    const genreId = b.genre_id === "" || b.genre_id === null || b.genre_id === undefined ? null : Number(b.genre_id);
    const { data, error } = await supabase
      .from("plans")
      .insert({
        genre_id: genreId,
        title: String(b.title).trim(),
        price: parseFloat(b.price),
        currency: "AZN",
        status: "draft",
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ plan: data });
    return;
  }

  if (action === "update_plan") {
    if (!b.plan_id) {
      res.status(400).json({ error: "plan_id yoxdur" });
      return;
    }
    const update: any = {};
    if (b.title !== undefined) update.title = String(b.title).trim();
    if (b.price !== undefined && b.price !== "") update.price = parseFloat(b.price);
    if (b.genre_id !== undefined) {
      update.genre_id = b.genre_id === "" || b.genre_id === null ? null : Number(b.genre_id);
    }
    const { data, error } = await supabase.from("plans").update(update).eq("id", b.plan_id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ plan: data });
    return;
  }

  if (action === "publish_plan") {
    if (!b.plan_id) {
      res.status(400).json({ error: "plan_id yoxdur" });
      return;
    }
    const { error } = await supabase
      .from("plans")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", b.plan_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "unpublish_plan") {
    if (!b.plan_id) {
      res.status(400).json({ error: "plan_id yoxdur" });
      return;
    }
    const { error } = await supabase.from("plans").update({ status: "draft" }).eq("id", b.plan_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "delete_plan") {
    if (!b.plan_id) {
      res.status(400).json({ error: "plan_id yoxdur" });
      return;
    }
    const { error } = await supabase.from("plans").delete().eq("id", b.plan_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  // Köhnə (Telegram botun mətn-menyusu üçün) həftəlik qiymətlər — legacy dəstək
  if (action === "update_bot_prices") {
    if (b.price_genre) await setSetting("price_genre", String(parseFloat(b.price_genre).toFixed(2)));
    if (b.price_mixed) await setSetting("price_mixed", String(parseFloat(b.price_mixed).toFixed(2)));
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "update_persona") {
    await setSetting("persona_style", String(b.persona_style || "").trim());
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "create_promo") {
    if (!b.code || !String(b.code).trim()) {
      res.status(400).json({ error: "Kod lazımdır." });
      return;
    }
    const { data, error } = await supabase
      .from("promo_codes")
      .insert({
        code: String(b.code).trim().toUpperCase(),
        discount_percent: b.discount_percent ? Number(b.discount_percent) : 100,
        max_uses: b.max_uses ? Number(b.max_uses) : null,
        expires_at: b.expires_at || null,
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message.includes("duplicate") ? "Bu kod artıq mövcuddur." : error.message });
      return;
    }
    res.status(200).json({ promo: data });
    return;
  }

  if (action === "toggle_promo") {
    if (!b.promo_id) {
      res.status(400).json({ error: "promo_id yoxdur" });
      return;
    }
    const { data: current } = await supabase.from("promo_codes").select("is_active").eq("id", b.promo_id).single();
    const { error } = await supabase
      .from("promo_codes")
      .update({ is_active: !current?.is_active })
      .eq("id", b.promo_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (action === "delete_promo") {
    if (!b.promo_id) {
      res.status(400).json({ error: "promo_id yoxdur" });
      return;
    }
    const { error } = await supabase.from("promo_codes").delete().eq("id", b.promo_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Naməlum əməliyyat" });
}
