import { Bot, InlineKeyboard, Keyboard } from "grammy";
import {
  getGenres,
  getLatestPublishedWeek,
  upsertUser,
  getSetting,
  supabase,
  getUser,
  getUserSession,
  setUserSession,
  clearUserSession,
} from "./supabase";
import { T } from "./texts";
import { createPayriffOrder } from "./payriff";
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
    await ctx.reply(T.welcome(ctx.from.first_name || ""));

    const user = await getUser(ctx.from.id);
    if (!user?.phone || !user?.email) {
      await setUserSession(ctx.from.id, { step: "name" });
      await ctx.reply(T.onboardingAskName);
      return;
    }

    await sendMainMenu(ctx);
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
      await sendMainMenu(ctx);
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
    kb.row().text(T.backBtn, "menu:main");
    await ctx.reply(T.chooseGenre, { reply_markup: kb });
  });

  bot.callbackQuery("menu:mixed", async (ctx) => {
    await ctx.answerCallbackQuery();
    const price = (await getSetting("price_mixed")) || "5.00";
    const currency = (await getSetting("currency")) || "AZN";
    const kb = new InlineKeyboard()
      .text(T.btnPay, "pay:mixed")
      .row()
      .text(T.backBtn, "menu:main");
    await ctx.reply(T.orderSummaryMixed(price, currency), {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  });

  bot.callbackQuery("menu:main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendMainMenu(ctx);
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
    const genres = await getGenres();
    const genre = genres.find((g) => g.id === genreId);
    const price = (await getSetting("price_genre")) || "3.00";
    const currency = (await getSetting("currency")) || "AZN";
    const kb = new InlineKeyboard()
      .text(T.btnPay, `pay:genre:${genreId}`)
      .row()
      .text(T.backBtn, "menu:by_genre");
    await ctx.reply(T.orderSummaryGenre(genre?.name_az || "", price, currency), {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^pay:(mixed|genre):?(\d+)?$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const kind = ctx.match![1];
    const genreId = ctx.match![2] ? Number(ctx.match![2]) : null;

    const week = await getLatestPublishedWeek();
    if (!week) return ctx.reply(T.noMoviesYet);

    const price =
      kind === "mixed"
        ? (await getSetting("price_mixed")) || "5.00"
        : (await getSetting("price_genre")) || "3.00";

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: ctx.from.id,
        week_id: week.id,
        genre_id: genreId,
        status: "pending",
        amount: parseFloat(price),
        currency: (await getSetting("currency")) || "AZN",
      })
      .select()
      .single();

    if (error || !sub) return ctx.reply(T.genericError);

    await ctx.reply(T.creatingPayment);

    const result = await createPayriffOrder({
      orderId: sub.id,
      amount: parseFloat(price),
      description: `MitoFilm — ${week.week_label}`,
    });

    if (!result.ok) {
      await ctx.reply(T.paymentFailedTryAgain);
      return;
    }

    await supabase
      .from("subscriptions")
      .update({ payriff_order_id: result.payriffOrderId })
      .eq("id", sub.id);

    await ctx.reply(T.paymentLinkReady(result.paymentUrl));
  });

  registerAdminHandlers(bot);
  registerAddMovieSaveHandler(bot);

  botInstance = bot;
  return bot;
}

async function sendMainMenu(ctx: any) {
  const base = process.env.PUBLIC_BASE_URL || "";
  const kb = new InlineKeyboard();
  if (base) kb.webApp(T.menuOpenSite, base).row();
  kb
    .text(T.btnByGenre, "menu:by_genre")
    .row()
    .text(T.btnMixed, "menu:mixed")
    .row()
    .text(T.btnMySubs, "menu:mysubs")
    .row()
    .text(T.btnHelp, "menu:help");
  await ctx.reply(T.mainMenuPrompt, { reply_markup: kb });
}

async function sendMySubs(ctx: any) {
  if (!ctx.from) return;
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*, weeks(week_label), genres(name_az)")
    .eq("user_id", ctx.from.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!subs || subs.length === 0) return ctx.reply(T.mySubsEmpty);

  const statusText = (s: string) =>
    s === "paid" ? T.statusPaid : s === "pending" ? T.statusPending : T.statusFailed;

  const lines = subs.map((s: any) =>
    T.subLine(
      s.genres?.name_az || "Qarışıq",
      statusText(s.status),
      s.weeks?.week_label || ""
    )
  );
  await ctx.reply([T.mySubsHeader, ...lines].join("\n"));
}
