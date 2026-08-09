// MitoFilm — bütün istifadəçiyə görünən mətnlər BURADA saxlanılır.
// Qayda: kodun heç bir yerində istifadəçiyə görünən İngilis mətn olmamalıdır.
// Texniki (database) sahə adları ingiliscə ola bilər, amma bu fayl yalnız
// insanın gördüyü mətnlərdir — hamısı Azərbaycan dilində.

export const T = {
  welcome: (name: string) =>
    `Salam, ${name}! 🎬\n\nMitoFilm-ə xoş gəldin — burada hər həftə diqqətlə seçilmiş filmlər səni gözləyir.\n\nİstəyirsən konkret janr üzrə tövsiyə al, istəyirsən qarışıq — həftənin ən yaxşılarını bir yerdə gör.`,

  mainMenuPrompt: "Nə ilə başlayaq?",
  btnByGenre: "🎭 Janra görə seç",
  btnMixed: "🍿 Qarışıq (bütün janrlar)",
  btnMySubs: "📋 Mənim abunəliklərim",
  btnHelp: "❓ Kömək",

  chooseGenre: "Hansı janr səni maraqlandırır?",
  backBtn: "◀️ Geriyə",

  orderSummaryGenre: (genre: string, price: string, currency: string) =>
    `Seçdiyin janr: *${genre}*\n\nBu janrda bu həftənin filmləri üçün qiymət: *${price} ${currency}*\n\nÖdənişi tamamladıqdan sonra 7 günlük film siyahısı dərhal sənə göndəriləcək.`,

  orderSummaryMixed: (price: string, currency: string) =>
    `Seçim: *Qarışıq — bütün janrlar*\n\nBu həftə üçün qiymət: *${price} ${currency}*\n\nÖdənişi tamamladıqdan sonra bütün janrlardan seçilmiş 7 günlük film siyahısı sənə göndəriləcək.`,

  btnPay: "💳 Ödə",
  btnCancel: "Ləğv et",

  creatingPayment: "Ödəniş linki hazırlanır, bir saniyə... ⏳",
  paymentLinkReady: (url: string) =>
    `Ödənişi tamamlamaq üçün aşağıdakı linkə keç:\n${url}\n\nÖdəniş uğurlu olan kimi filmlər avtomatik göndəriləcək.`,
  paymentFailedTryAgain: "Ödəniş linki yaradıla bilmədi. Bir az sonra yenidən cəhd et 🙏",

  paymentConfirmedHeader: (label: string) =>
    `✅ Ödəniş təsdiqləndi! "${label}" üçün bu həftənin filmləri:`,
  paymentNotFound: "Bu ödəniş tapılmadı və ya artıq işlənib.",

  noMoviesYet: "Bu həftə üçün hələ film əlavə olunmayıb. Tezliklə yenilənəcək 🎥",

  movieCard: (m: {
    title: string;
    year?: number | null;
    imdb?: number | null;
    country?: string | null;
    director?: string | null;
    actors?: string | null;
    runtime?: number | null;
    desc?: string | null;
    review?: string | null;
    trailer?: string | null;
    watch: string;
  }) => {
    const lines: string[] = [];
    lines.push(`🎬 *${m.title}*${m.year ? ` (${m.year})` : ""}`);
    if (m.imdb) lines.push(`⭐ IMDb reytinqi: ${m.imdb}`);
    if (m.country) lines.push(`🌍 Ölkə: ${m.country}`);
    if (m.director) lines.push(`🎥 Rejissor: ${m.director}`);
    if (m.actors) lines.push(`👥 Aktyorlar: ${m.actors}`);
    if (m.runtime) lines.push(`⏱ Müddət: ${m.runtime} dəqiqə`);
    if (m.desc) lines.push(`\n${m.desc}`);
    if (m.review) lines.push(`\n💬 MitoFilm rəyi: ${m.review}`);
    if (m.trailer) lines.push(`\n▶️ Treylerə bax: ${m.trailer}`);
    lines.push(`\n🔗 İndi izlə: ${m.watch}`);
    return lines.join("\n");
  },

  mySubsHeader: "Abunəliklərin:",
  mySubsEmpty: "Hələ heç bir abunəliyin yoxdur. Yuxarıdan janr seç və başla 🎬",
  subLine: (label: string, status: string, week: string) =>
    `• ${week} — ${label} — ${status}`,
  statusPending: "ödəniş gözlənilir",
  statusPaid: "ödənilib ✅",
  statusFailed: "uğursuz",

  help:
    "MitoFilm belə işləyir:\n\n1️⃣ Janr seç (və ya qarışıq)\n2️⃣ Ödənişi tamamla\n3️⃣ 7 günlük film siyahısını al\n\nSual olsa, sadəcə yaz — kömək etməyə hazırıq 🎬",

  notAdmin: "Bu əmr yalnız adminlər üçündür.",

  adminMenu: "Admin paneli:",
  adminBtnNewWeek: "🆕 Yeni həftə yarat",
  adminBtnAddMovie: "➕ Film əlavə et",
  adminBtnListMovies: "📋 Bu həftənin filmləri",
  adminBtnPublish: "📢 Həftəni yayımla",
  adminBtnPrices: "💰 Bot qiymətləri (Telegram)",
  adminBtnSitePrices: "🌐 Sayt qiymətləri (1g/7g/1ay)",
  adminBtnCancelFlow: "✖️ Ləğv et",

  adminNoActiveWeek:
    "Aktiv (draft) həftə tapılmadı. Əvvəlcə \"Yeni həftə yarat\" düyməsinə bas.",
  adminWeekCreated: (label: string) => `Yeni həftə yaradıldı: *${label}*`,
  adminAskWeekLabel:
    "Yeni həftənin adını yaz (məs: \"10-16 Avqust\"):",

  adminAskGenre: "Film hansı janrdadır?",
  adminAskTitle: "Filmin adını yaz:",
  adminAskOriginalTitle:
    "Orijinal adı yaz (yoxdursa \"keç\" yaz):",
  adminAskPoster: "Poster şəklinin linkini göndər:",
  adminAskYear: "Buraxılış ilini yaz (rəqəmlə, məs: 2023):",
  adminAskImdb: "IMDb reytinqini yaz (məs: 7.8, yoxdursa \"keç\" yaz):",
  adminAskCountry: "Ölkəni yaz:",
  adminAskDirector: "Rejissoru yaz:",
  adminAskActors: "Əsas aktyorları yaz (vergüllə ayır):",
  adminAskRuntime: "Filmin müddətini dəqiqə ilə yaz (məs: 118):",
  adminAskDesc: "Qısa təsviri yaz:",
  adminAskReview:
    "MitoFilm rəyini yaz (özün yaz, ya da \"ai\" yazsan süni intellekt sənin üçün qaralama hazırlayacaq):",
  adminAskTrailer: "Treyler linkini göndər (yoxdursa \"keç\" yaz):",
  adminAskWatchUrl: "Rəsmi izləmə linkini göndər:",

  adminInvalidNumber: "Bu rəqəm deyil, bir də cəhd et:",
  adminSkipHint: "(keçmək üçün \"keç\" yaz)",

  adminMovieConfirm: (title: string) =>
    `Film hazırdır: *${title}*\n\nYadda saxlayım?`,
  adminBtnSaveMovie: "✅ Yadda saxla",
  adminMovieSaved: (title: string) => `"${title}" bu həftəyə əlavə olundu ✅`,

  adminFlowCancelled: "Əməliyyat ləğv edildi.",

  adminMoviesListHeader: (label: string) => `*${label}* həftəsinin filmləri:`,
  adminMoviesListEmpty: "Bu həftəyə hələ film əlavə olunmayıb.",

  adminPublishConfirm: (label: string, count: number) =>
    `"${label}" həftəsini yayımlayım? (${count} film)`,
  adminBtnConfirmPublish: "📢 Bəli, yayımla",
  adminPublished: (label: string) =>
    `"${label}" həftəsi yayımlandı! İstifadəçilər indi ödəniş edib filmlərə çata bilər 🎉`,
  adminNothingToPublish: "Yayımlamaq üçün heç bir film yoxdur.",

  adminAskGenrePrice: "Janr üzrə qiyməti yaz (AZN, məs: 3.00):",
  adminAskMixedPrice: "Qarışıq seçim üçün qiyməti yaz (AZN, məs: 5.00):",
  adminPricesUpdated: "Qiymətlər yeniləndi ✅",

  adminAskSitePriceGenreDay: "Sayt — Janr, 1 günlük qiymət (AZN, məs: 1.00):",
  adminAskSitePriceGenreWeek: "Sayt — Janr, 7 günlük qiymət (AZN, məs: 3.00):",
  adminAskSitePriceGenreMonth: "Sayt — Janr, 1 aylıq qiymət (AZN, məs: 8.00):",
  adminAskSitePriceMixedDay: "Sayt — Qarışıq, 1 günlük qiymət (AZN, məs: 1.50):",
  adminAskSitePriceMixedWeek: "Sayt — Qarışıq, 7 günlük qiymət (AZN, məs: 5.00):",
  adminAskSitePriceMixedMonth: "Sayt — Qarışıq, 1 aylıq qiymət (AZN, məs: 12.00):",

  genericError: "Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏",
};
