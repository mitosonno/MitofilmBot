import type { VercelRequest, VercelResponse } from "@vercel/node";
import { webhookCallback } from "grammy";
import { getBot } from "../lib/bot";

const handleUpdate = webhookCallback(getBot(), "std/http");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(200).send("MitoFilm bot işləyir.");
    return;
  }

  // Webhook təhlükəsizliyi: Telegram-ın göndərdiyi gizli başlığı yoxla
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send("unauthorized");
    return;
  }

  try {
    // grammy-nin std/http adapteri Request/Response obyektləri gözləyir,
    // ona görə Vercel-in req/res-ini adapt edirik.
    const request = new Request(`https://dummy${req.url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const response = await handleUpdate(request);
    res.status(response.status).send(await response.text());
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(200).send("ok"); // Telegram-a hər zaman 200 qaytar ki, təkrar-təkrar göndərməsin
  }
}
