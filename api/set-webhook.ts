import type { VercelRequest, VercelResponse } from "@vercel/node";

// Deploy etdikdən SONRA, bir dəfə brauzerdə aç:
// https://SİZİN-DOMAIN.vercel.app/api/set-webhook
// Bu, Telegram-a botun webhook ünvanını bildirir.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const base = process.env.PUBLIC_BASE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !base) {
    res.status(400).send("TELEGRAM_BOT_TOKEN və ya PUBLIC_BASE_URL təyin olunmayıb");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${base}/api/webhook`,
      secret_token: secret || undefined,
    }),
  });
  const data = await resp.json();
  res.status(200).json(data);
}
