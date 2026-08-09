import OpenAI from "openai";
import { getSetting } from "./supabase";

// Diqqət: OpenAI SDK-sı, açar olmadan constructor çağırılanda xəta atır.
// Ona görə client-i YALNIZ lazım olanda (funksiya çağırılanda) yaradırıq —
// beləliklə OPENAI_API_KEY təyin olunmasa belə, botun qalan hissəsi normal işləyir.
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// MitoFilm-in persona qaydaları — yükləmiş olduğun dil sənədindən götürülüb.
const PERSONA_SYSTEM_PROMPT = `Sən MitoFilm-in kino bloqçususan. Sadəcə texniki sistem deyilsən —
peşəkar kino eksperti kimi danışırsan: canlı, emosional, peşəkar, qısa, maraqlı, təbii.
Robotik ifadələr işlətmə ("Bu film sizin üçün tövsiyə olunur" kimi qəliblərdən qaçın).
Əvəzində məsələn: "Əgər gərgin və atmosferli detektivləri sevirsənsə, bunu siyahının əvvəlinə yaz." kimi yaz.
Yalnız Azərbaycan dilində, təbii və müasir dildə yaz — Türkiyə türkcəsi və ya rus/ingilis dilindən
sözbəsöz tərcümə kimi səslənməsin. Azərbaycan əlifbasından düzgün istifadə et (ə, ı, ö, ü, ğ, ç, ş).
Cavabların 2-4 cümlədən çox olmasın.`;

// Admin panelində ("MitoFilm-in səsi") yazılan əlavə üslub təlimatları varsa,
// onları da əsas persona-nın üstünə əlavə edirik. Bu, AI-nin "öyrənməsinin" praktik
// yoludur — həqiqi özbaşına öyrənmə deyil, admin özü nümunə/qeyd yazıb tənzimləyir.
async function getFullPersonaPrompt(): Promise<string> {
  const custom = await getSetting("persona_style");
  if (custom && custom.trim()) {
    return `${PERSONA_SYSTEM_PROMPT}\n\nAdmin-in əlavə üslub qeydləri (bunlara da riayət et):\n${custom.trim()}`;
  }
  return PERSONA_SYSTEM_PROMPT;
}

export async function generateMitoReview(movie: {
  title: string;
  year?: number | null;
  genre?: string | null;
  shortDescription?: string | null;
}): Promise<string> {
  const client = getClient();
  if (!client) {
    return "";
  }

  const userPrompt = `Film: "${movie.title}"${movie.year ? ` (${movie.year})` : ""}
Janr: ${movie.genre || "naməlum"}
Qısa təsvir: ${movie.shortDescription || "yoxdur"}

Bu film üçün MitoFilm-in öz üslubunda qısa bir rəy/tövsiyə yaz (2-4 cümlə).`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: await getFullPersonaPrompt() },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 220,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

// --- Telegram bot üçün "MitoFilm agenti" (canlı söhbət) ---

export async function generateGreeting(userName: string): Promise<string> {
  const client = getClient();
  const fallback = `Salam, ${userName}! 🎬 Necəsən, əhvalın necədir bu gün? Hansı janrda filmə baxmaq həvəsindəsən — yaz mənə, ya da aşağıdan seç.`;
  if (!client) return fallback;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: await getFullPersonaPrompt() },
        {
          role: "user",
          content: `İstifadəçinin adı: ${userName}. Onu adı ilə səmimi salamla, bu gün necə olduğunu soruş,
sonra hansı janrda filmə baxmaq istədiyini soruş. 2-3 qısa cümlə, isti və dost kimi.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 150,
    });
    return completion.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function chatConcierge(params: {
  userMessage: string;
  genreNames: string[];
}): Promise<{ genre: string | null; reply: string }> {
  const client = getClient();

  if (!client) {
    // OpenAI olmadan sadə fallback: mətndə janr adını axtar
    const found = params.genreNames.find((g) => params.userMessage.toLowerCase().includes(g.toLowerCase()));
    return {
      genre: found || null,
      reply: found
        ? `${found} — əla seçimdi! Sənə uyğun tövsiyələri indi göstərirəm.`
        : "Janrı tam anlamadım — adını yaza bilərsən (məs: \"qorxu\"), ya da aşağıdan seç.",
    };
  }

  const basePersona = await getFullPersonaPrompt();
  const systemPrompt = `${basePersona}

Sən MitoFilm-in Telegram botusan və istifadəçi ilə canlı söhbət edirsən. Məqsədin onun HANSI JANRDA
film istədiyini anlamaqdır. Mövcud janrlar: ${params.genreNames.join(", ")}. Əgər istifadəçi qarışıq/hamısı/
fərq etməz kimi bir şey desə, "Qarışıq" seç. Əgər aydın deyilsə (məs: "bilmirəm", salamlaşma, əlaqəsiz mesaj),
genre sahəsini null qoy və dostcasına aydınlaşdırıcı sual ver ya da bir janr təklif et.

YALNIZ bu JSON formatında cavab ver, başqa HEÇ NƏ yazma (izah, markdown, əlavə mətn yox):
{"genre": "<janrlardan biri, ya da \\"Qarışıq\\", ya da null>", "reply": "<istifadəçiyə göstəriləcək qısa cavab, 1-3 cümlə>"}`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.userMessage },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      genre: parsed.genre ?? null,
      reply: parsed.reply || "Deyəsən başa düşmədim, bir də yaza bilərsən?",
    };
  } catch {
    return { genre: null, reply: "Deyəsən başa düşmədim, bir də yaza bilərsən?" };
  }
}
