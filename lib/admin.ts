import { Bot, InlineKeyboard } from "grammy";
import {
  supabase,
  getGenres,
  getDraftWeek,
  getAdminSession,
  setAdminSession,
  clearAdminSession,
  getSetting,
  setSetting,
} from "./supabase";
import { T } from "./texts";
import { generateMitoReview } from "./openai";

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

export function isAdmin(id: number) {
  return ADMIN_IDS.includes(id);
}

const DAYS = [
  "Bazar ertəsi",
  "Çərşənbə axşamı",
  "Çərşənbə",
  "Cümə axşamı",
  "Cümə",
  "Şənbə",
  "Bazar",
];

function dayKeyboard() {
  const kb = new InlineKeyboard();
  DAYS.forEach((d, i) => {
    kb.text(d, `am_day:${i}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

export function adminMenuKeyboard() {
  return new InlineKeyboard()
    .text(T.adminBtnNewWeek, "admin:new_week").row()
    .text(T.adminBtnAddMovie, "admin:add_movie").row()
    .text(T.adminBtnListMovies, "admin:list_movies").row()
    .text(T.adminBtnPublish, "admin:publish").row()
    .text(T.adminBtnPrices, "admin:prices").row()
    .text(T.adminBtnSitePrices, "admin:site_prices");
}

function genreKeyboard(genres: { id: number; name_az: string }[], prefix: string) {
  const kb = new InlineKeyboard();
  genres.forEach((g, i) => {
    kb.text(g.name_az, `${prefix}:${g.id}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

export async function registerAdminHandlers(bot: Bot) {
  bot.command("admin", async (ctx) => {
    const id = ctx.from?.id;
    if (!id || !isAdmin(id)) return ctx.reply(T.notAdmin);
    await clearAdminSession(id);
    const base = process.env.PUBLIC_BASE_URL || "";
    const kb = new InlineKeyboard().webApp("🛠 Admin panelini aç", `${base}/admin.html`);
    await ctx.reply("Admin panelini Mini App daxilində aç:", { reply_markup: kb });
  });

  bot.callbackQuery("admin:new_week", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    await setAdminSession(id, { flow: "new_week", step: "label" });
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminAskWeekLabel);
  });

  bot.callbackQuery("admin:add_movie", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    const week = await getDraftWeek();
    await ctx.answerCallbackQuery();
    if (!week) return ctx.reply(T.adminNoActiveWeek);
    const genres = await getGenres();
    await setAdminSession(id, { flow: "add_movie", step: "genre", data: { week_id: week.id } });
    await ctx.reply(T.adminAskGenre, { reply_markup: genreKeyboard(genres, "am_genre") });
  });

  bot.callbackQuery(/^am_genre:(\d+)$/, async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    const session = await getAdminSession(id);
    if (!session || session.flow !== "add_movie") return ctx.answerCallbackQuery();
    session.data.genre_id = Number(ctx.match![1]);
    session.step = "title";
    await setAdminSession(id, session);
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminAskTitle);
  });

  bot.callbackQuery(/^am_day:(\d)$/, async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    const session = await getAdminSession(id);
    if (!session || session.flow !== "add_movie") return ctx.answerCallbackQuery();
    session.data.recommended_day = DAYS[Number(ctx.match![1])];
    session.step = "time";
    await setAdminSession(id, session);
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminAskTime);
  });

  bot.callbackQuery("admin:list_movies", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    const week = await getDraftWeek();
    if (!week) return ctx.reply(T.adminNoActiveWeek);
    const { data: movies } = await supabase
      .from("movies")
      .select("title, genre_id")
      .eq("week_id", week.id);
    await ctx.reply(T.adminMoviesListHeader(week.week_label), { parse_mode: "Markdown" });
    if (!movies || movies.length === 0) {
      await ctx.reply(T.adminMoviesListEmpty);
    } else {
      await ctx.reply(movies.map((m, i) => `${i + 1}. ${m.title}`).join("\n"));
    }
  });

  bot.callbackQuery("admin:publish", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    const week = await getDraftWeek();
    if (!week) return ctx.reply(T.adminNoActiveWeek);
    const { count } = await supabase
      .from("movies")
      .select("*", { count: "exact", head: true })
      .eq("week_id", week.id);
    if (!count) return ctx.reply(T.adminNothingToPublish);
    const kb = new InlineKeyboard().text(T.adminBtnConfirmPublish, `admin:publish_confirm:${week.id}`);
    await ctx.reply(T.adminPublishConfirm(week.week_label, count), { reply_markup: kb });
  });

  bot.callbackQuery(/^admin:publish_confirm:(.+)$/, async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    const weekId = ctx.match![1];
    await supabase
      .from("weeks")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", weekId);
    await ctx.answerCallbackQuery();
    const { data: week } = await supabase.from("weeks").select("*").eq("id", weekId).single();
    await ctx.reply(T.adminPublished(week?.week_label || ""));
  });

  bot.callbackQuery("admin:prices", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    await setAdminSession(id, { flow: "prices", step: "genre_price", data: {} });
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminAskGenrePrice);
  });

  bot.callbackQuery("admin:site_prices", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    await setAdminSession(id, { flow: "site_prices", step: "genre_day", data: {} });
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminAskSitePriceGenreDay);
  });

  // Mətn mesajları — cari admin sessiyasına görə emal olunur
  bot.on("message:text", async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id || !isAdmin(id)) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return next(); // əmrlər heç vaxt sessiya-mətni kimi tutulmasın

    const session = await getAdminSession(id);
    if (!session) return next();

    if (session.flow === "new_week" && session.step === "label") {
      const { data: week } = await supabase
        .from("weeks")
        .insert({ week_label: text, status: "draft" })
        .select()
        .single();
      await clearAdminSession(id);
      await ctx.reply(T.adminWeekCreated(week!.week_label), { parse_mode: "Markdown" });
      return;
    }

    if (session.flow === "prices") {
      if (session.step === "genre_price") {
        const val = parseFloat(text.replace(",", "."));
        if (isNaN(val)) return ctx.reply(T.adminInvalidNumber);
        session.data.genre_price = val;
        session.step = "mixed_price";
        await setAdminSession(id, session);
        return ctx.reply(T.adminAskMixedPrice);
      }
      if (session.step === "mixed_price") {
        const val = parseFloat(text.replace(",", "."));
        if (isNaN(val)) return ctx.reply(T.adminInvalidNumber);
        await setSetting("price_genre", String(session.data.genre_price));
        await setSetting("price_mixed", String(val));
        await clearAdminSession(id);
        return ctx.reply(T.adminPricesUpdated);
      }
    }

    if (session.flow === "site_prices") {
      const steps: { step: string; next?: string; nextPrompt?: string; settingKey: string }[] = [
        { step: "genre_day", next: "genre_week", nextPrompt: T.adminAskSitePriceGenreWeek, settingKey: "price_genre_day" },
        { step: "genre_week", next: "genre_month", nextPrompt: T.adminAskSitePriceGenreMonth, settingKey: "price_genre_week" },
        { step: "genre_month", next: "mixed_day", nextPrompt: T.adminAskSitePriceMixedDay, settingKey: "price_genre_month" },
        { step: "mixed_day", next: "mixed_week", nextPrompt: T.adminAskSitePriceMixedWeek, settingKey: "price_mixed_day" },
        { step: "mixed_week", next: "mixed_month", nextPrompt: T.adminAskSitePriceMixedMonth, settingKey: "price_mixed_week" },
        { step: "mixed_month", settingKey: "price_mixed_month" },
      ];
      const current = steps.find((s) => s.step === session.step);
      if (current) {
        const val = parseFloat(text.replace(",", "."));
        if (isNaN(val)) return ctx.reply(T.adminInvalidNumber);
        await setSetting(current.settingKey, val.toFixed(2));
        if (current.next) {
          session.step = current.next;
          await setAdminSession(id, session);
          return ctx.reply(current.nextPrompt!);
        } else {
          await clearAdminSession(id);
          return ctx.reply(T.adminPricesUpdated);
        }
      }
    }

    if (session.flow === "add_movie") {
      await handleAddMovieStep(ctx, id, session, text);
      return;
    }

    return next();
  });
}

async function handleAddMovieStep(ctx: any, adminId: number, session: any, text: string) {
  const d = session.data;
  const skip = text.toLowerCase() === "keç" || text.toLowerCase() === "kec";

  switch (session.step) {
    case "title":
      d.title = text;
      session.step = "original_title";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskOriginalTitle);

    case "original_title":
      d.original_title = skip ? null : text;
      session.step = "poster";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskPoster);

    case "poster":
      d.poster_url = text;
      session.step = "year";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskYear);

    case "year": {
      const y = parseInt(text, 10);
      if (isNaN(y)) return ctx.reply(T.adminInvalidNumber);
      d.release_year = y;
      session.step = "imdb";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskImdb);
    }

    case "imdb":
      if (skip) {
        d.imdb_rating = null;
      } else {
        const r = parseFloat(text.replace(",", "."));
        if (isNaN(r)) return ctx.reply(T.adminInvalidNumber);
        d.imdb_rating = r;
      }
      session.step = "country";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskCountry);

    case "country":
      d.country = text;
      session.step = "director";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskDirector);

    case "director":
      d.director = text;
      session.step = "actors";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskActors);

    case "actors":
      d.actors = text;
      session.step = "runtime";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskRuntime);

    case "runtime": {
      const r = parseInt(text, 10);
      if (isNaN(r)) return ctx.reply(T.adminInvalidNumber);
      d.runtime_minutes = r;
      session.step = "desc";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskDesc);
    }

    case "desc":
      d.short_description = text;
      session.step = "review";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskReview);

    case "review": {
      if (text.toLowerCase() === "ai") {
        const genres = await getGenres();
        const genreName = genres.find((g) => g.id === d.genre_id)?.name_az || null;
        try {
          d.mito_review = await generateMitoReview({
            title: d.title,
            year: d.release_year,
            genre: genreName,
            shortDescription: d.short_description,
          });
        } catch {
          d.mito_review = "";
        }
      } else {
        d.mito_review = text;
      }
      session.step = "trailer";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskTrailer);
    }

    case "trailer":
      d.trailer_url = skip ? null : text;
      session.step = "watch_url";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskWatchUrl);

    case "watch_url": {
      d.official_watch_url = text;
      session.step = "day";
      await setAdminSession(adminId, session);
      return ctx.reply(T.adminAskDay, { reply_markup: dayKeyboard() });
    }

    case "time": {
      d.recommended_time = skip ? null : text;
      session.step = "confirm";
      await setAdminSession(adminId, session);
      const kb = { reply_markup: { inline_keyboard: [[{ text: T.adminBtnSaveMovie, callback_data: "am_save" }]] } };
      return ctx.reply(T.adminMovieConfirm(d.title), { parse_mode: "Markdown", ...kb });
    }
  }
}

export function registerAddMovieSaveHandler(bot: Bot) {
  bot.callbackQuery("am_save", async (ctx) => {
    const id = ctx.from.id;
    if (!isAdmin(id)) return ctx.answerCallbackQuery();
    const session = await getAdminSession(id);
    if (!session || session.flow !== "add_movie") return ctx.answerCallbackQuery();
    const d = session.data;

    await supabase.from("movies").insert({
      week_id: d.week_id,
      genre_id: d.genre_id,
      title: d.title,
      original_title: d.original_title,
      poster_url: d.poster_url,
      release_year: d.release_year,
      imdb_rating: d.imdb_rating,
      country: d.country,
      director: d.director,
      actors: d.actors,
      runtime_minutes: d.runtime_minutes,
      short_description: d.short_description,
      mito_review: d.mito_review,
      trailer_url: d.trailer_url,
      official_watch_url: d.official_watch_url,
      recommended_day: d.recommended_day,
      recommended_time: d.recommended_time,
    });

    await clearAdminSession(id);
    await ctx.answerCallbackQuery();
    await ctx.reply(T.adminMovieSaved(d.title));
  });
}
