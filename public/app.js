let STATE = null; // /api/public-plans cavabı
let selectedGenreId = undefined; // undefined = seçilməyib, null = qarışıq, rəqəm = janr id

const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
function getTelegramUserId() {
  try {
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || null;
  } catch (e) {
    return null;
  }
}

const tgUid = getTelegramUserId();
if (tgUid) {
  const link = document.getElementById("historyLink");
  link.href = `/history.html?tg=${tgUid}`;
  link.style.display = "inline-block";

  if (tg && tg.initData) {
    fetch("/api/admin-state", { headers: { "X-Telegram-Init-Data": tg.initData } })
      .then((r) => {
        if (r.ok) document.getElementById("adminLink").style.display = "inline-block";
      })
      .catch(() => {});
  }
}

async function loadData() {
  const genresRoot = document.getElementById("genresRoot");
  const teaserEl = document.getElementById("teaser");

  try {
    const res = await fetch("/api/public-plans");
    STATE = await res.json();

    if (!STATE.plans || STATE.plans.length === 0) {
      genresRoot.innerHTML = `
        <div class="empty-state">
          Hazırda aktiv tövsiyə yoxdur. Tezliklə yeni planlar açılacaq 🎬
        </div>`;
      teaserEl.style.display = "none";
      document.getElementById("weekLabel").style.display = "none";
      return;
    }

    document.getElementById("weekLabel").style.display = "none";

    if (STATE.teaser && STATE.teaser.length > 0) {
      teaserEl.innerHTML = STATE.teaser
        .map((m) => `<img src="${escapeAttr(m.poster)}" alt="${escapeAttr(m.title)}" loading="lazy" />`)
        .join("");
    } else {
      teaserEl.style.display = "none";
    }

    renderGenres();
  } catch (e) {
    genresRoot.innerHTML = `<div class="empty-state">Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏</div>`;
  }
}

function renderGenres() {
  const genresRoot = document.getElementById("genresRoot");

  // Yalnız içində ən azı 1 plan olan janrları göstər (+ Qarışıq, əgər varsa)
  const genresWithPlans = STATE.genres.filter((g) => STATE.plans.some((p) => p.genre_id === g.id));
  const hasMixed = STATE.plans.some((p) => p.genre_id === null);

  const genreCards = genresWithPlans
    .map(
      (g) => `
    <div class="ticket genre-card" data-genre-id="${g.id}">
      <div class="ticket-main">
        <span class="ticket-tag">Janr</span>
        <h3>${escapeHtml(g.name_az)}</h3>
        <p>Bu janrdan seçilmiş tövsiyələr.</p>
      </div>
      <div class="ticket-stub">
        <span class="price">Planlar →</span>
        <button class="btn-select" data-genre-id="${g.id}">Seç</button>
      </div>
    </div>`
    )
    .join("");

  const mixedCard = hasMixed
    ? `
    <div class="ticket featured genre-card" data-genre-id="">
      <div class="ticket-main">
        <span class="ticket-tag">Qarışıq</span>
        <h3>Bütün janrlar</h3>
        <p>Bütün janrlardan seçilmiş tövsiyələr — hamısı bir yerdə.</p>
      </div>
      <div class="ticket-stub">
        <span class="price">Planlar →</span>
        <button class="btn-select" data-genre-id="">Seç</button>
      </div>
    </div>`
    : "";

  genresRoot.innerHTML = `<div class="tickets">${genreCards}${mixedCard}</div>`;

  document.querySelectorAll(".genre-card").forEach((card) => {
    card.addEventListener("click", () => {
      const val = card.getAttribute("data-genre-id");
      selectGenre(val === "" ? null : Number(val));
    });
  });
}

function selectGenre(genreId) {
  selectedGenreId = genreId;

  document.querySelectorAll(".genre-card").forEach((card) => {
    const val = card.getAttribute("data-genre-id");
    const cardGenreId = val === "" ? null : Number(val);
    card.classList.toggle("selected", cardGenreId === genreId);
  });

  const genreName = genreId === null ? "Qarışıq" : (STATE.genres.find((g) => g.id === genreId) || {}).name_az || "";
  document.getElementById("planHeading").textContent = `${genreName} üçün planını seç`;

  const plans = STATE.plans.filter((p) => p.genre_id === genreId);

  document.getElementById("plansRoot").innerHTML = plans.length
    ? `<div class="tickets plans">${plans.map(planCardHtml).join("")}</div>`
    : `<div class="empty-state">Bu janr üçün hələ tövsiyə planı yoxdur.</div>`;

  document.querySelectorAll("#plansRoot .btn-select").forEach((btn) => {
    btn.addEventListener("click", () => handleOrder(btn.getAttribute("data-plan-id")));
  });

  document.getElementById("planSection").style.display = "block";
  document.getElementById("planSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function planCardHtml(p) {
  return `
    <div class="ticket plan-card">
      <div class="ticket-main">
        <span class="ticket-tag">${p.movieCount} film</span>
        <h3>${escapeHtml(p.title)}</h3>
      </div>
      <div class="ticket-stub">
        <span class="price">${p.price} <small>${escapeHtml(p.currency)}</small></span>
        <button class="btn-select" data-plan-id="${p.id}">Seç</button>
      </div>
    </div>`;
}

document.getElementById("changeGenre").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("planSection").style.display = "none";
  selectedGenreId = undefined;
  document.querySelectorAll(".genre-card").forEach((c) => c.classList.remove("selected"));
  document.getElementById("genresRoot").scrollIntoView({ behavior: "smooth", block: "start" });
});

async function handleOrder(planId) {
  const msgEl = document.getElementById("orderMsg");
  msgEl.textContent = "";

  const buttons = document.querySelectorAll("#plansRoot .btn-select");
  buttons.forEach((b) => (b.disabled = true));

  try {
    const res = await fetch("/api/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, telegramUserId: getTelegramUserId() }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      msgEl.textContent = data.error || "Sifariş yaradıla bilmədi.";
      buttons.forEach((b) => (b.disabled = false));
      return;
    }

    window.location.href = data.paymentUrl;
  } catch (e) {
    msgEl.textContent = "Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏";
    buttons.forEach((b) => (b.disabled = false));
  }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}
function escapeAttr(s) {
  return (s || "").replace(/"/g, "&quot;");
}

loadData();
