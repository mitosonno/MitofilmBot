import type { VercelRequest, VercelResponse } from "@vercel/node";

// Deploy etdikdən SONRA, bir dəfə brauzerdə aç:
// https://SİZİN-DOMAIN.vercel.app/api/setup                    → webhook qeydiyyatı
// https://SİZİN-DOMAIN.vercel.app/api/setup?action=menu-button  → "Yeni tövsiyə al" sabit düyməsi

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const base = process.env.PUBLIC_BASE_URL;
  const action = (req.query.action as string) || "webhook";

  if (!token || !base) {
    res.status(400).send("TELEGRAM_BOT_TOKEN və ya PUBLIC_BASE_URL təyin olunmayıb");
    return;
  }

  if (action === "menu-button") {
    const resp = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Yeni tövsiyə al", web_app: { url: base } },
      }),
    });
    const data = await resp.json();
    res.status(200).json(data);
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${base}/api/webhook`, secret_token: secret || undefined }),
  });
  const data = await resp.json();
  res.status(200).json(data);
}
