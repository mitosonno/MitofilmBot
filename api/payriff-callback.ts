import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../lib/supabase";
import { deliverMoviesForSubscription } from "../lib/deliver";
import { verifyPayriffOrder } from "../lib/payriff";

// Payriff ödəniş uğurlu olandan sonra bu endpoint-ə POST sorğusu göndərir.
// DİQQƏT: Payriff Dashboard-da bu URL-i "Callback URL" kimi qeyd et:
// https://SİZİN-DOMAIN.vercel.app/api/payriff-callback
//
// Payriff-in göndərdiyi body-nin dəqiq formatını canlı test edərkən dəqiqləşdir
// (bəzi hesablarda orderId, bəzilərində order.id kimi gələ bilər) — aşağıda hər
// iki ehtimala baxılır.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("method not allowed");
    return;
  }

  try {
    const body = req.body || {};
    const ourOrderId: string | undefined =
      body.orderId || body.order?.id || body.body?.orderId;
    const payriffOrderId: string | undefined =
      body.payriffOrderId || body.order?.payriffOrderId;

    if (!ourOrderId) {
      res.status(400).send("orderId yoxdur");
      return;
    }

    // Etibarlılığı yoxlamaq üçün Payriff-dən statusu bir də soruş (tövsiyə olunur)
    if (payriffOrderId) {
      const check = await verifyPayriffOrder(payriffOrderId);
      if (!check.paid) {
        res.status(200).send("gözlənilir");
        return;
      }
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("id", ourOrderId)
      .maybeSingle();

    if (!sub) {
      res.status(404).send("abunəlik tapılmadı");
      return;
    }

    await deliverMoviesForSubscription(sub.id);

    res.status(200).send("ok");
  } catch (err) {
    console.error("Payriff callback error:", err);
    res.status(500).send("xəta");
  }
}
