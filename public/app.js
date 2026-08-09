let STATE = null; // /api/public-week cavabı
let selectedGenreId = undefined; // undefined = seçilməyib, null = qarışıq, rəqəm = janr id

// Telegram Mini App kimi açılıbsa (bot içindən), açılan pəncərəni genişləndir
// və istifadəçini tanı ki, sifariş birbaşa onun Telegram hesabına bağlansın.
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

async function loadWeek() {
  const genresRoot = document.getElementById("genresRoot");
  const weekLabelEl = document.getElementById("weekLabel");
  const teaserEl = document.getElementById("teaser");

  try {
    const res = await fetch("/api/public-week");
    const data = await res.json();
    STATE = data;

    if (!data.week) {
      genresRoot.innerHTML = `
        <div class="empty-state">
          Hazırda aktiv tövsiyə yoxdur. Tezliklə yeni həftənin filmləri açılacaq 🎬
        </div>`;
      teaserEl.style.display = "none";
      return;
    }

    weekLabelEl.textContent = data.week.label;

    if (data.teaser && data.teaser.length > 0) {
      teaserEl.innerHTML = data.teaser
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

  const genreCards = STATE.genres
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

  const mixedCard = `
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
    </div>`;

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

  const genreName =
    genreId === null
      ? "Qarışıq"
      : (STATE.genres.find((g) => g.id === genreId) || {}).name_az || "";

  document.getElementById("planHeading").textContent = `${genreName} üçün planını seç`;

  const priceSet = genreId === null ? STATE.prices.mixed : STATE.prices.genre;
  const currency = STATE.currency;

  const plans = [
    { key: "day", label: "1 günlük", desc: "Həftənin 1 seçilmiş filmi.", price: priceSet.day },
    { key: "week", label: "7 günlük", desc: "Bu həftənin bütün tövsiyələri (7 film).", price: priceSet.week },
    { key: "month", label: "1 aylıq", desc: "Son 1 ayın bütün tövsiyələri (~30 film).", price: priceSet.month },
  ];

  document.getElementById("plansRoot").innerHTML = `
    <div class="tickets plans">
      ${plans
        .map(
          (p) => `
        <div class="ticket plan-card ${p.key === "week" ? "featured" : ""}">
          <div class="ticket-main">
            <span class="ticket-tag">${p.label}</span>
            <p>${p.desc}</p>
          </div>
          <div class="ticket-stub">
            <span class="price">${p.price} <small>${currency}</small></span>
            <button class="btn-select" data-duration="${p.key}">Seç</button>
          </div>
        </div>`
        )
        .join("")}
    </div>`;

  document.querySelectorAll("#plansRoot .btn-select").forEach((btn) => {
    btn.addEventListener("click", () => handleOrder(btn.getAttribute("data-duration")));
  });

  document.getElementById("planSection").style.display = "block";
  document.getElementById("planSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("changeGenre").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("planSection").style.display = "none";
  selectedGenreId = undefined;
  document.querySelectorAll(".genre-card").forEach((c) => c.classList.remove("selected"));
  document.getElementById("genresRoot").scrollIntoView({ behavior: "smooth", block: "start" });
});

async function handleOrder(duration) {
  const msgEl = document.getElementById("orderMsg");
  msgEl.textContent = "";

  const buttons = document.querySelectorAll("#plansRoot .btn-select");
  buttons.forEach((b) => (b.disabled = true));

  try {
    const res = await fetch("/api/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genreId: selectedGenreId, duration, telegramUserId: getTelegramUserId() }),
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

loadWeek();
