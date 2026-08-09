function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

const DAY_ORDER = [
  "Bazar ertəsi",
  "Çərşənbə axşamı",
  "Çərşənbə",
  "Cümə axşamı",
  "Cümə",
  "Şənbə",
  "Bazar",
];

function renderPending() {
  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <div class="spinner"></div>
      <h2>Ödəniş təsdiqlənir...</h2>
      <p style="color:var(--muted)">Bir neçə saniyə gözlə, filmlərin hazırlanır 🎬</p>
    </div>`;
}

function renderNotFound() {
  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <h2>Bu sifariş tapılmadı</h2>
      <p style="color:var(--muted)">Link köhnə ola bilər. Ana səhifədən yenidən plan götürə bilərsən.</p>
    </div>`;
}

function renderCancelledOrDeclined() {
  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <h2>Ödəniş tamamlanmadı</h2>
      <p style="color:var(--muted)">İstəsən ana səhifədən yenidən cəhd edə bilərsən.</p>
    </div>`;
}

let CURRENT_MOVIES = [];

function renderPaid(data) {
  CURRENT_MOVIES = data.movies;

  const sorted = [...data.movies].sort((a, b) => {
    const ai = a.day ? DAY_ORDER.indexOf(a.day) : 99;
    const bi = b.day ? DAY_ORDER.indexOf(b.day) : 99;
    return ai - bi;
  });

  const cardsHtml = sorted
    .map((m, sortedIdx) => {
      const originalIdx = data.movies.indexOf(m);
      const badge = m.day ? `${m.day}${m.time ? ", " + m.time : ""}` : "";
      return `
      <div class="movie-card" data-idx="${originalIdx}">
        <div class="movie-poster-wrap">
          <img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)}" loading="lazy" />
          ${badge ? `<span class="day-badge">${escapeHtml(badge)}</span>` : ""}
        </div>
        <div class="card-title">${escapeHtml(m.title)}</div>
      </div>`;
    })
    .join("");

  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <span class="eyebrow">✅ Ödəniş təsdiqləndi</span>
      <h2>${escapeHtml(data.label)} — ${escapeHtml(data.weekLabel)}</h2>
    </div>
    ${
      sorted.length > 0
        ? `<div class="movies-grid">${cardsHtml}</div>`
        : `<div class="empty-state">Bu plan üçün hələ film əlavə olunmayıb. Tezliklə yenilənəcək 🎬</div>`
    }`;

  document.querySelectorAll(".movie-card").forEach((card) => {
    card.addEventListener("click", () => openModal(Number(card.getAttribute("data-idx"))));
  });
}

function openModal(idx) {
  const m = CURRENT_MOVIES[idx];
  if (!m) return;

  const metaParts = [];
  if (m.year) metaParts.push(m.year);
  if (m.imdb) metaParts.push(`⭐ ${m.imdb}`);
  if (m.country) metaParts.push(m.country);
  if (m.director) metaParts.push(m.director);
  if (m.runtime) metaParts.push(`${m.runtime} dəq`);

  const badge = m.day ? `${m.day}${m.time ? ", " + m.time : ""}` : "";

  document.getElementById("modalSheet").innerHTML = `
    <button class="modal-close" id="modalCloseBtn">✕</button>
    <img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)}" />
    <div class="modal-body">
      ${badge ? `<span class="modal-day-badge">${escapeHtml(badge)}</span>` : ""}
      <h3>${escapeHtml(m.title)}</h3>
      <div class="modal-meta">${escapeHtml(metaParts.join(" · "))}</div>
      ${m.desc ? `<p>${escapeHtml(m.desc)}</p>` : ""}
      ${m.review ? `<p class="modal-review">${escapeHtml(m.review)}</p>` : ""}
      <div class="modal-links">
        <a href="${escapeHtml(m.watch)}" target="_blank" rel="noopener">İndi izlə</a>
        ${m.trailer ? `<a href="${escapeHtml(m.trailer)}" target="_blank" rel="noopener">Treyler</a>` : ""}
      </div>
    </div>`;

  const overlay = document.getElementById("modalOverlay");
  overlay.classList.add("open");
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

async function poll(orderId, attempt = 0) {
  try {
    const res = await fetch(`/api/public-order?id=${encodeURIComponent(orderId)}`);
    const data = await res.json();

    if (data.status === "paid") {
      renderPaid(data);
      return;
    }
    if (data.status === "not_found") {
      renderNotFound();
      return;
    }
    if (data.status === "failed" || data.status === "cancelled") {
      renderCancelledOrDeclined();
      return;
    }

    if (attempt >= 25) {
      renderPending();
      return;
    }
    setTimeout(() => poll(orderId, attempt + 1), 2500);
  } catch (e) {
    setTimeout(() => poll(orderId, attempt + 1), 3000);
  }
}

const orderId = getParam("order");
if (!orderId) {
  renderNotFound();
} else if (getParam("cancelled") || getParam("declined")) {
  renderCancelledOrDeclined();
} else {
  renderPending();
  poll(orderId);
}
