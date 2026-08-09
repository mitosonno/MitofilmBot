import type { VercelRequest, VercelResponse } from "@vercel/node";

// Deploy etdikdən SONRA, bir dəfə brauzerdə aç:
// https://SİZİN-DOMAIN.vercel.app/api/set-menu-button
// Bu, botun söhbət pəncərəsinin sol-alt küncündə HƏMİŞƏ görünən
// "Yeni tövsiyə al" düyməsini qurur (sayt Mini App kimi açılır).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const base = process.env.PUBLIC_BASE_URL;

  if (!token || !base) {
    res.status(400).send("TELEGRAM_BOT_TOKEN və ya PUBLIC_BASE_URL təyin olunmayıb");
    return;
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      menu_button: {
        type: "web_app",
        text: "Yeni tövsiyə al",
        web_app: { url: base },
      },
    }),
  });
  const data = await resp.json();
  res.status(200).json(data);
}
