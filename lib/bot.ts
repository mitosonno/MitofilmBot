import { Bot, InlineKeyboard, Keyboard } from "grammy";
import {
  getGenres,
  upsertUser,
  supabase,
  getUser,
  getUserSession,
  setUserSession,
  clearUserSession,
  getPublishedPlansForGenre,
} from "./supabase";
import { T } from "./texts";
import { chatConcierge } from "./openai";
import { registerAdminHandlers, registerAddMovieSaveHandler, isAdmin } from "./admin";

let botInstance: Bot | null = null;

export function getBot(): Bot {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    await upsertUser({
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
    });

    const user = await getUser(ctx.from.id);
    if (!user?.phone || !user?.email) {
      await ctx.reply(T.welcome(ctx.from.first_name || ""));
      await setUserSession(ctx.from.id, { step: "name" });
      await ctx.reply(T.onboardingAskName);
      return;
    }

    await sendConciergeGreeting(ctx);
  });

  bot.on("message:contact", async (ctx) => {
    if (!ctx.from || !ctx.message.contact) return;
    const session = await getUserSession(ctx.from.id);
    if (!session || session.step !== "phone") return;

    await supabase
      .from("users")
      .update({ phone: ctx.message.contact.phone_number })
      .eq("id", ctx.from.id);

    session.step = "email";
    await setUserSession(ctx.from.id, session);
    await ctx.reply(T.onboardingAskEmail, { reply_markup: { remove_keyboard: true } });
  });

  // Onboarding (ad → telefon → email) — admin-in mətn axınından ƏVVƏL yoxlanılır,
  // aktiv onboarding sessiyası yoxdursa `next()` ilə növbəti handler-lərə ötürülür.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) return next();
    const session = await getUserSession(ctx.from.id);
    if (!session) return next();

    const text = ctx.message.text.trim();

    if (session.step === "name") {
      await supabase.from("users").update({ full_name: text }).eq("id", ctx.from.id);
      session.step = "phone";
      await setUserSession(ctx.from.id, session);
      const kb = new Keyboard().requestContact(T.onboardingSharePhoneBtn).resized().oneTime();
      await ctx.reply(T.onboardingAskPhone, { reply_markup: kb });
      return;
    }

    if (session.step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        await ctx.reply(T.onboardingInvalidEmail);
        return;
      }
      await supabase.from("users").update({ email: text }).eq("id", ctx.from.id);
      await clearUserSession(ctx.from.id);
      await ctx.reply(T.onboardingDone(ctx.from.first_name || ""));
      await sendConciergeGreeting(ctx);
      return;
    }

    if (session.step === "awaiting_genre") {
      const genres = await getGenres();
      const result = await chatConcierge({ userMessage: text, genreNames: genres.map((g) => g.name_az) });
      await ctx.reply(result.reply);

      if (result.genre) {
        if (result.genre === "Qarışıq") {
          await presentPlansForGenre(ctx, null);
          return;
        }
        const matched = genres.find((g) => g.name_az.toLowerCase() === result.genre!.toLowerCase());
        if (matched) {
          await presentPlansForGenre(ctx, matched.id);
          return;
        }
      }
      // aydın olmadı — sessiya "awaiting_genre" olaraq qalır, istifadəçi yenidən yaza bilər
      return;
    }

    return next();
  });

  bot.command("help", async (ctx) => ctx.reply(T.help));

  bot.command("mysubs", async (ctx) => sendMySubs(ctx));

  bot.callbackQuery("menu:by_genre", async (ctx) => {
    await ctx.answerCallbackQuery();
    const genres = await getGenres();
    const kb = new InlineKeyboard();
    genres.forEach((g, i) => {
      kb.text(g.name_az, `user_genre:${g.id}`);
      if (i % 2 === 1) kb.row();
    });
    await ctx.reply(T.chooseGenre, { reply_markup: kb });
  });

  bot.callbackQuery("menu:mixed", async (ctx) => {
    await ctx.answerCallbackQuery();
    await presentPlansForGenre(ctx, null);
  });

  bot.callbackQuery("menu:mysubs", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendMySubs(ctx);
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(T.help);
  });

  bot.callbackQuery(/^user_genre:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const genreId = Number(ctx.match![1]);
    await presentPlansForGenre(ctx, genreId);
  });

  bot.callbackQuery(/^buyplan:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const planId = ctx.match![1];
    const base = process.env.PUBLIC_BASE_URL || "";
    const kb = new InlineKeyboard().webApp("💳 Ödəniş et", `${base}/pay.html?plan=${planId}`);
    await ctx.reply("Ödənişi tamamlamaq üçün aşağıya bas — Mini App daxilində dərhal açılacaq:", {
      reply_markup: kb,
    });
  });

  registerAdminHandlers(bot);
  registerAddMovieSaveHandler(bot);

  botInstance = bot;
  return bot;
}

// İstifadəçini adı ilə, MitoFilm-in canlı səsi ilə salamlayır və janr soruşur.
// Cavab gözlənilən "awaiting_genre" sessiyası açılır ki, sərbəst yazılan mesaj da tutulsun.
async function sendConciergeGreeting(ctx: any) {
  if (!ctx.from) return;
  await ctx.reply(T.conciergeGreeting(ctx.from.first_name || "dostum"));
  await setUserSession(ctx.from.id, { step: "awaiting_genre" });

  const genres = await getGenres();
  const kb = new InlineKeyboard();
  genres.forEach((g, i) => {
    kb.text(g.name_az, `user_genre:${g.id}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text(T.btnMixed, "menu:mixed");
  await ctx.reply("Janrını yaz (məs: \"qorxu\"), ya da aşağıdan seç:", { reply_markup: kb });
}

// Seçilmiş janr (və ya Qarışıq — null) üçün admin-in yaratdığı YAYIMLANMIŞ planları göstərir.
async function presentPlansForGenre(ctx: any, genreId: number | null) {
  const plans = await getPublishedPlansForGenre(genreId);

  if (plans.length === 0) {
    await ctx.reply("Təəssüf ki, bu janr üçün hazırda aktiv plan yoxdur. Başqa janr sınaya bilərsən 🎬");
    return;
  }

  const kb = new InlineKeyboard();
  plans.forEach((p) => {
    kb.text(`${p.title} — ${p.price} ${p.currency}`, `buyplan:${p.id}`).row();
  });

  await ctx.reply("Bunlardan birini seç:", { reply_markup: kb });
}

async function sendMySubs(ctx: any) {
  if (!ctx.from) return;
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*, plans(title, genre_id, genres(name_az))")
    .eq("user_id", ctx.from.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!subs || subs.length === 0) return ctx.reply(T.mySubsEmpty);

  const statusText = (s: string) =>
    s === "paid" ? T.statusPaid : s === "pending" ? T.statusPending : T.statusFailed;

  const lines = subs.map((s: any) =>
    T.subLine(
      s.plans?.genre_id ? s.plans?.genres?.name_az || "Janr" : "Qarışıq",
      statusText(s.status),
      s.plans?.title || ""
    )
  );
  await ctx.reply([T.mySubsHeader, ...lines].join("\n"));
}
