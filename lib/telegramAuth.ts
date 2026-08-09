import crypto from "crypto";

// Telegram-ın rəsmi Mini App initData doğrulama alqoritmi:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Bu, initData-nın HƏQİQƏTƏN Telegram tərəfindən imzalandığını təsdiqləyir —
// beləliklə istənilən adam telegramUserId-ni "uydurub" admin kimi görünə bilməz.
export function verifyTelegramInitData(
  initData: string
): { id: number; first_name?: string; username?: string } | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const pairs: string[] = [];
    params.forEach((value, key) => pairs.push(`${key}=${value}`));
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.TELEGRAM_BOT_TOKEN || "")
      .digest();
    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) return null;

    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function requireAdminFromInitData(
  initData: string | string[] | undefined
): number | null {
  if (!initData || Array.isArray(initData)) return null;
  const user = verifyTelegramInitData(initData);
  if (!user) return null;

  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

  return adminIds.includes(user.id) ? user.id : null;
}

// İkinci qorunma qatı: admin panelinə giriş üçün ayrıca şifrə.
// ADMIN_PASSWORD təyin olunmayıbsa, bu yoxlama keçilir (geriyə uyğunluq üçün) —
// amma ciddi istifadə üçün mütləq təyin olunmalıdır.
export function checkAdminPassword(password: string | string[] | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return true;
  if (!password || Array.isArray(password)) return false;
  return password === expected;
}
