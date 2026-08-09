async function loadWeek() {
  const ticketsRoot = document.getElementById("ticketsRoot");
  const weekLabelEl = document.getElementById("weekLabel");
  const teaserEl = document.getElementById("teaser");

  try {
    const res = await fetch("/api/public-week");
    const data = await res.json();

    if (!data.week) {
      ticketsRoot.innerHTML = `
        <div class="empty-state">
          Hazırda aktiv bilet yoxdur. Tezliklə yeni həftənin filmləri açılacaq 🎬
        </div>`;
      teaserEl.style.display = "none";
      return;
    }

    weekLabelEl.textContent = data.week.label;

    // Teaser posters
    if (data.teaser && data.teaser.length > 0) {
      teaserEl.innerHTML = data.teaser
        .map((m) => `<img src="${escapeAttr(m.poster)}" alt="${escapeAttr(m.title)}" loading="lazy" />`)
        .join("");
    } else {
      teaserEl.style.display = "none";
    }

    // Tickets: genres + featured mixed
    const genreCards = data.genres
      .map(
        (g) => `
      <div class="ticket" data-genre="${g.id}">
        <div class="ticket-main">
          <span class="ticket-tag">Janr bileti</span>
          <h3>${escapeHtml(g.name_az)}</h3>
          <p>Bu janrdan seçilmiş 7 günlük film siyahısı.</p>
        </div>
        <div class="ticket-stub">
          <span class="price">${data.prices.genre} <small>${data.prices.currency}</small></span>
          <button class="btn-select" data-genre-id="${g.id}">Seç</button>
        </div>
      </div>`
      )
      .join("");

    const mixedCard = `
      <div class="ticket featured">
        <div class="ticket-main">
          <span class="ticket-tag">Tam bilet</span>
          <h3>Qarışıq</h3>
          <p>Bütün janrlardan seçilmiş filmlər — bir bilətdə hamısı.</p>
        </div>
        <div class="ticket-stub">
          <span class="price">${data.prices.mixed} <small>${data.prices.currency}</small></span>
          <button class="btn-select" data-genre-id="">Seç</button>
        </div>
      </div>`;

    ticketsRoot.innerHTML = `<div class="tickets">${genreCards}${mixedCard}</div>`;

    document.querySelectorAll(".btn-select").forEach((btn) => {
      btn.addEventListener("click", () => handleSelect(btn));
    });
  } catch (e) {
    ticketsRoot.innerHTML = `<div class="empty-state">Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏</div>`;
  }
}

async function handleSelect(btn) {
  const msgEl = document.getElementById("orderMsg");
  const genreId = btn.getAttribute("data-genre-id");
  msgEl.textContent = "";

  document.querySelectorAll(".btn-select").forEach((b) => (b.disabled = true));
  btn.textContent = "Hazırlanır...";

  try {
    const res = await fetch("/api/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genreId: genreId ? Number(genreId) : null }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      msgEl.textContent = data.error || "Sifariş yaradıla bilmədi.";
      resetButtons();
      return;
    }

    window.location.href = data.paymentUrl;
  } catch (e) {
    msgEl.textContent = "Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏";
    resetButtons();
  }
}

function resetButtons() {
  document.querySelectorAll(".btn-select").forEach((b) => {
    b.disabled = false;
    b.textContent = "Seç";
  });
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
