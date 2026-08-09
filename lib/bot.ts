import { Bot, InlineKeyboard } from "grammy";
import {
  getGenres,
  getLatestPublishedWeek,
  upsertUser,
  getSetting,
  supabase,
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
    await sendMainMenu(ctx);
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
  const kb = new InlineKeyboard()
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
