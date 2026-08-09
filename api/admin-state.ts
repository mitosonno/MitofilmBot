import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminFromInitData } from "../lib/telegramAuth";
import { supabase, getGenres, getAllAdminPlans, getSetting } from "../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const initData = req.headers["x-telegram-init-data"] as string | undefined;
  const adminId = requireAdminFromInitData(initData);
  if (!adminId) {
    res.status(401).json({ error: "Bu bölmə yalnız admin üçündür." });
    return;
  }

  const [genres, plans, botPriceGenre, botPriceMixed, personaStyle, promoCodes] = await Promise.all([
    getGenres(),
    getAllAdminPlans(),
    getSetting("price_genre"),
    getSetting("price_mixed"),
    getSetting("persona_style"),
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).then((r) => r.data || []),
  ]);

  const planIds = plans.map((p: any) => p.id);
  let counts: Record<string, number> = {};
  if (planIds.length > 0) {
    const { data: movieRows } = await supabase.from("plan_movies").select("plan_id").in("plan_id", planIds);
    (movieRows || []).forEach((m: any) => {
      counts[m.plan_id] = (counts[m.plan_id] || 0) + 1;
    });
  }

  res.status(200).json({
    genres,
    plans: plans.map((p: any) => ({
      id: p.id,
      genre_id: p.genre_id,
      genreName: p.genre_id ? p.genres?.name_az : "Qarışıq",
      title: p.title,
      price: p.price,
      currency: p.currency,
      status: p.status,
      movieCount: counts[p.id] || 0,
    })),
    botPrices: { genre: botPriceGenre || "3.00", mixed: botPriceMixed || "5.00" },
    personaStyle: personaStyle || "",
    promoCodes,
  });
}
