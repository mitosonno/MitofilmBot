// Payriff inteqrasiyası
//
// DİQQƏT: Bu fayl Payriff-in ümumi Gateway API sxeminə əsasən yazılıb
// (createOrder sorğusu: amount, approveURL, cancelURL, declineURL, description,
// orderId, sessionId + merchant, Authorization header-də merchant secret key).
// Real merchant hesabını aldıqdan sonra Payriff Dashboard > Developers bölməsindəki
// cari sənədlə (endpoint yolları, cavab formatı) MÜTLƏQ tutuşdur — kiçik fərqlər
// ola bilər. Əvvəlcə Payriff-in test rejimində yoxla, sonra canlıya keç.

const BASE_URL = process.env.PAYRIFF_BASE_URL || "https://api.payriff.com";
const MERCHANT_ID = process.env.PAYRIFF_MERCHANT_ID!;
const SECRET_KEY = process.env.PAYRIFF_SECRET_KEY!;

export async function createPayriffOrder(params: {
  orderId: string; // bizim subscription.id (uuid) — bank tərəfi üçün unikal
  amount: number;
  description: string;
}): Promise<{ ok: true; paymentUrl: string; payriffOrderId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v3/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: SECRET_KEY,
      },
      body: JSON.stringify({
        body: {
          amount: params.amount,
          approveURL: process.env.PAYRIFF_APPROVE_URL || "",
          cancelURL: process.env.PAYRIFF_CANCEL_URL || "",
          declineURL: process.env.PAYRIFF_DECLINE_URL || "",
          description: params.description,
          orderId: params.orderId,
          language: "AZ",
          currencyType: "AZN",
        },
        merchant: MERCHANT_ID,
      }),
    });

    const data = await res.json();

    if (!res.ok || data?.code !== "00000") {
      return {
        ok: false,
        error: data?.message || data?.internalMessage || `HTTP ${res.status}`,
      };
    }

    const paymentUrl = data?.payload?.paymentUrl || data?.body?.paymentUrl;
    const payriffOrderId = data?.payload?.orderId || params.orderId;

    if (!paymentUrl) {
      return { ok: false, error: "Payriff cavabında paymentUrl tapılmadı" };
    }

    return { ok: true, paymentUrl, payriffOrderId };
  } catch (e: any) {
    return { ok: false, error: e?.message || "naməlum xəta" };
  }
}

export async function verifyPayriffOrder(
  payriffOrderId: string
): Promise<{ paid: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v3/orders/${payriffOrderId}`, {
      method: "GET",
      headers: { Authorization: SECRET_KEY },
    });
    const data = await res.json();
    const status =
      data?.payload?.status || data?.payload?.orderStatus || data?.status;
    return { paid: status === "APPROVED" || status === "SUCCESS" };
  } catch {
    return { paid: false };
  }
}
