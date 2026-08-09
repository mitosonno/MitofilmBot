import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// MitoFilm-in persona qaydaları — yükləmiş olduğun dil sənədindən götürülüb.
const PERSONA_SYSTEM_PROMPT = `Sən MitoFilm-in kino bloqçususan. Sadəcə texniki sistem deyilsən —
peşəkar kino eksperti kimi danışırsan: canlı, emosional, peşəkar, qısa, maraqlı, təbii.
Robotik ifadələr işlətmə ("Bu film sizin üçün tövsiyə olunur" kimi qəliblərdən qaçın).
Əvəzində məsələn: "Əgər gərgin və atmosferli detektivləri sevirsənsə, bunu siyahının əvvəlinə yaz." kimi yaz.
Yalnız Azərbaycan dilində, təbii və müasir dildə yaz — Türkiyə türkcəsi və ya rus/ingilis dilindən
sözbəsöz tərcümə kimi səslənməsin. Azərbaycan əlifbasından düzgün istifadə et (ə, ı, ö, ü, ğ, ç, ş).
Cavabların 2-4 cümlədən çox olmasın.`;

export async function generateMitoReview(movie: {
  title: string;
  year?: number | null;
  genre?: string | null;
  shortDescription?: string | null;
}): Promise<string> {
  const userPrompt = `Film: "${movie.title}"${movie.year ? ` (${movie.year})` : ""}
Janr: ${movie.genre || "naməlum"}
Qısa təsvir: ${movie.shortDescription || "yoxdur"}

Bu film üçün MitoFilm-in öz üslubunda qısa bir rəy/tövsiyə yaz (2-4 cümlə).`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: PERSONA_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 220,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}
