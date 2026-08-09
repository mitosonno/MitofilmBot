import nodemailer from "nodemailer";

// Email göndərmək üçün SMTP məlumatları lazımdır (məs: Gmail App Password).
// Əgər bunlar təyin olunmayıbsa, funksiya sakitcə heç nə etmir —
// sistemin qalan hissəsi bundan asılı olmadan işləməyə davam edir.
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function escapeHtml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendReceiptEmail(params: {
  to: string;
  planLabel: string; // məs: "Dram — 7 günlük"
  amount: number;
  currency: string;
  movies: { title: string; poster: string; watch: string; desc?: string | null }[];
}) {
  const transport = getTransport();
  if (!transport) return;

  const moviesHtml = params.movies
    .map(
      (m) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">
          <img src="${escapeHtml(m.poster)}" width="56" style="border-radius:6px;vertical-align:top;margin-right:12px;" />
          <span style="font-weight:700;">${escapeHtml(m.title)}</span><br/>
          ${m.desc ? `<span style="color:#666;font-size:13px;">${escapeHtml(m.desc)}</span><br/>` : ""}
          <a href="${escapeHtml(m.watch)}" style="color:#B23A55;font-weight:700;font-size:13px;">İndi izlə</a>
        </td>
      </tr>`
    )
    .join("");

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: `MitoFilm — ${params.planLabel} tövsiyələrin hazırdır 🎬`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="margin-bottom:4px;">Ödənişin təsdiqləndi ✅</h2>
          <p style="color:#666;">${escapeHtml(params.planLabel)} — ${params.amount} ${params.currency}</p>
          <table style="width:100%;border-collapse:collapse;">${moviesHtml}</table>
          <p style="color:#999;font-size:12px;margin-top:24px;">MitoFilm — həftəlik kino seçkisi.</p>
        </div>`,
    });
  } catch (e) {
    console.error("Email göndərilmədi:", e);
  }
}
