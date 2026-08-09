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
      <p style="color:var(--muted)">Link köhnə ola bilər. Ana səhifədən yenidən bilet götürə bilərsən.</p>
    </div>`;
}

function renderCancelledOrDeclined() {
  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <h2>Ödəniş tamamlanmadı</h2>
      <p style="color:var(--muted)">İstəsən ana səhifədən yenidən cəhd edə bilərsən.</p>
    </div>`;
}

function renderPaid(data) {
  const moviesHtml = data.movies
    .map((m) => {
      const metaParts = [];
      if (m.year) metaParts.push(m.year);
      if (m.imdb) metaParts.push(`⭐ ${m.imdb}`);
      if (m.country) metaParts.push(m.country);
      if (m.runtime) metaParts.push(`${m.runtime} dəq`);

      return `
      <div class="movie-card">
        <img src="${escapeHtml(m.poster)}" alt="${escapeHtml(m.title)}" loading="lazy" />
        <div class="movie-body">
          <h3>${escapeHtml(m.title)}</h3>
          <div class="meta">${escapeHtml(metaParts.join(" · "))}</div>
          ${m.desc ? `<p>${escapeHtml(m.desc)}</p>` : ""}
          ${m.review ? `<p class="review">${escapeHtml(m.review)}</p>` : ""}
          <div class="links">
            <a href="${escapeHtml(m.watch)}" target="_blank" rel="noopener">İndi izlə</a>
            ${m.trailer ? `<a href="${escapeHtml(m.trailer)}" target="_blank" rel="noopener">Treyler</a>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  document.getElementById("content").innerHTML = `
    <div class="result-head">
      <span class="eyebrow">✅ Ödəniş təsdiqləndi</span>
      <h2>${escapeHtml(data.label)} — ${escapeHtml(data.weekLabel)}</h2>
    </div>
    ${
      data.movies.length > 0
        ? `<div class="movies-grid">${moviesHtml}</div>`
        : `<div class="empty-state">Bu həftə üçün hələ film əlavə olunmayıb. Tezliklə yenilənəcək 🎬</div>`
    }`;
}

async function poll(orderId, attempt = 0) {
  try {
    const res = await fetch(`/api/public-order-status?id=${encodeURIComponent(orderId)}`);
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

    // hələ "pending" — davam et
    if (attempt >= 25) {
      renderPending(); // uzun çəkirsə, sadəcə gözləmə vəziyyətində saxla
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
