const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
const INIT_DATA = tg ? tg.initData : "";

const DAYS = [
  "Bazar ertəsi",
  "Çərşənbə axşamı",
  "Çərşənbə",
  "Cümə axşamı",
  "Cümə",
  "Şənbə",
  "Bazar",
];

let STATE = null;
let selectedDay = null;

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}
function escapeAttr(s) {
  return (s || "").toString().replace(/"/g, "&quot;");
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": INIT_DATA,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xəta baş verdi");
  return data;
}

function showToast(text) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--gold);color:#241005;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.35);";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.display = "block";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.display = "none"), 2500);
}

function confirmDialog(text) {
  return new Promise((resolve) => {
    if (tg && tg.showConfirm) tg.showConfirm(text, (ok) => resolve(ok));
    else resolve(window.confirm(text));
  });
}

async function init() {
  const gate = document.getElementById("gate");
  if (!INIT_DATA) {
    gate.textContent = "Bu səhifə yalnız Telegram daxilində açılır.";
    return;
  }
  try {
    STATE = await api("/api/admin-state");
  } catch (e) {
    gate.textContent = "Bu bölmə yalnız admin üçündür.";
    return;
  }
  gate.style.display = "none";
  document.getElementById("adminRoot").style.display = "block";
  render();
}

function render() {
  const root = document.getElementById("adminRoot");
  root.innerHTML = `
    <div class="admin-card">
      <h2>Cari həftə</h2>
      ${STATE.week ? weekBoxHtml() : newWeekFormHtml()}
    </div>
    ${STATE.week ? moviesCardHtml() : ""}
    <div class="admin-card">
      <h2>Sayt qiymətləri (1g / 7g / 1ay)</h2>
      ${sitePricesFormHtml()}
    </div>
    <div class="admin-card">
      <h2>Bot qiymətləri (Telegram, həftəlik)</h2>
      ${botPricesFormHtml()}
    </div>
    ${publishedWeeksHtml()}
  `;
  wireEvents();
}

function weekBoxHtml() {
  return `
    <p style="margin:0 0 14px;font-weight:700;">${escapeHtml(STATE.week.week_label)}</p>
    <div class="form-actions">
      <button id="publishBtn" class="btn btn-gold">📢 Həftəni yayımla (${STATE.movies.length} film)</button>
    </div>
    <div class="msg-box" id="weekMsg"></div>`;
}

function newWeekFormHtml() {
  return `
    <div class="field">
      <label>Həftənin adı</label>
      <input type="text" id="newWeekLabel" placeholder="məs: 10-16 Avqust" />
    </div>
    <button id="createWeekBtn" class="btn btn-gold">Yeni həftə yarat</button>
    <div class="msg-box" id="weekMsg"></div>`;
}

function moviesCardHtml() {
  const rows = STATE.movies
    .map(
      (m) => `
    <div class="admin-movie-row">
      <div class="info">
        ${m.poster_url ? `<img src="${escapeAttr(m.poster_url)}" />` : `<span class="movie-thumb-fallback"></span>`}
        <div>
          <div class="name">${escapeHtml(m.title)}</div>
          <div class="sub">${escapeHtml((m.genres && m.genres.name_az) || "")}${m.recommended_day ? " · " + escapeHtml(m.recommended_day) : ""}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="icon-btn edit-movie" data-id="${m.id}">Redaktə</button>
        <button class="icon-btn del-movie" data-id="${m.id}">Sil</button>
      </div>
    </div>`
    )
    .join("");

  return `
    <div class="admin-card">
      <h2>Filmlər (${STATE.movies.length})</h2>
      ${rows || '<p style="color:var(--muted);font-size:14px;">Hələ film yoxdur.</p>'}
      <div class="form-actions">
        <button id="addMovieBtn" class="btn btn-gold">+ Film əlavə et</button>
      </div>
    </div>`;
}

function sitePricesFormHtml() {
  const p = STATE.prices.site;
  return `
    <div class="field-row">
      <div class="field"><label>Janr — 1 günlük</label><input id="p_genre_day" type="number" step="0.01" value="${escapeAttr(p.genre.day)}" /></div>
      <div class="field"><label>Janr — 7 günlük</label><input id="p_genre_week" type="number" step="0.01" value="${escapeAttr(p.genre.week)}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Janr — 1 aylıq</label><input id="p_genre_month" type="number" step="0.01" value="${escapeAttr(p.genre.month)}" /></div>
      <div class="field"><label>Qarışıq — 1 günlük</label><input id="p_mixed_day" type="number" step="0.01" value="${escapeAttr(p.mixed.day)}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Qarışıq — 7 günlük</label><input id="p_mixed_week" type="number" step="0.01" value="${escapeAttr(p.mixed.week)}" /></div>
      <div class="field"><label>Qarışıq — 1 aylıq</label><input id="p_mixed_month" type="number" step="0.01" value="${escapeAttr(p.mixed.month)}" /></div>
    </div>
    <button id="saveSitePricesBtn" class="btn btn-gold">Yadda saxla</button>
    <div class="msg-box" id="sitePricesMsg"></div>`;
}

function botPricesFormHtml() {
  const p = STATE.prices.bot;
  return `
    <div class="field-row">
      <div class="field"><label>Janr üzrə</label><input id="p_bot_genre" type="number" step="0.01" value="${escapeAttr(p.genre)}" /></div>
      <div class="field"><label>Qarışıq</label><input id="p_bot_mixed" type="number" step="0.01" value="${escapeAttr(p.mixed)}" /></div>
    </div>
    <button id="saveBotPricesBtn" class="btn btn-gold">Yadda saxla</button>
    <div class="msg-box" id="botPricesMsg"></div>`;
}

function publishedWeeksHtml() {
  if (!STATE.publishedWeeks || STATE.publishedWeeks.length === 0) return "";
  const rows = STATE.publishedWeeks
    .map((w) => `<div style="padding:6px 0;color:var(--muted);font-size:13px;">${escapeHtml(w.week_label)}</div>`)
    .join("");
  return `<div class="admin-card"><h2>Son yayımlanan həftələr</h2>${rows}</div>`;
}

function wireEvents() {
  const createBtn = document.getElementById("createWeekBtn");
  if (createBtn) createBtn.addEventListener("click", createWeek);

  const publishBtn = document.getElementById("publishBtn");
  if (publishBtn) publishBtn.addEventListener("click", publishWeek);

  const addBtn = document.getElementById("addMovieBtn");
  if (addBtn) addBtn.addEventListener("click", () => openMovieModal(null));

  document.querySelectorAll(".edit-movie").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-id");
      const movie = STATE.movies.find((m) => m.id === id);
      openMovieModal(movie);
    })
  );
  document.querySelectorAll(".del-movie").forEach((b) =>
    b.addEventListener("click", () => deleteMovie(b.getAttribute("data-id")))
  );

  const saveSite = document.getElementById("saveSitePricesBtn");
  if (saveSite) saveSite.addEventListener("click", saveSitePrices);
  const saveBot = document.getElementById("saveBotPricesBtn");
  if (saveBot) saveBot.addEventListener("click", saveBotPrices);
}

async function createWeek() {
  const label = document.getElementById("newWeekLabel").value.trim();
  const msg = document.getElementById("weekMsg");
  if (!label) {
    msg.textContent = "Həftənin adını yaz.";
    return;
  }
  try {
    const data = await api("/api/admin-week", { method: "POST", body: JSON.stringify({ label }) });
    STATE.week = data.week;
    STATE.movies = [];
    render();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function publishWeek() {
  const msg = document.getElementById("weekMsg");
  if (STATE.movies.length === 0) {
    msg.textContent = "Əvvəlcə ən azı 1 film əlavə et.";
    return;
  }
  const ok = await confirmDialog(`"${STATE.week.week_label}" həftəsini yayımlayım?`);
  if (!ok) return;
  try {
    await api("/api/admin-publish", { method: "POST", body: JSON.stringify({ week_id: STATE.week.id }) });
    STATE = await api("/api/admin-state");
    render();
    showToast("Həftə yayımlandı ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function deleteMovie(id) {
  const ok = await confirmDialog("Bu filmi silmək istəyirsən?");
  if (!ok) return;
  try {
    await api(`/api/admin-movie?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    STATE.movies = STATE.movies.filter((m) => m.id !== id);
    render();
    showToast("Silindi");
  } catch (e) {
    showToast(e.message);
  }
}

function openMovieModal(movie) {
  selectedDay = movie ? movie.recommended_day : null;

  const genreOptions = STATE.genres
    .map(
      (g) =>
        `<option value="${g.id}" ${movie && movie.genre_id === g.id ? "selected" : ""}>${escapeHtml(g.name_az)}</option>`
    )
    .join("");

  const dayPills = DAYS.map(
    (d) => `<button type="button" class="day-pill ${d === selectedDay ? "selected" : ""}" data-day="${escapeAttr(d)}">${escapeHtml(d)}</button>`
  ).join("");

  document.getElementById("modalSheet").innerHTML = `
    <button class="modal-close" id="modalCloseBtn">✕</button>
    <div class="modal-body">
      <h3 style="margin-top:0">${movie ? "Filmi redaktə et" : "Yeni film"}</h3>
      <div class="field"><label>Janr</label><select id="f_genre">${genreOptions}</select></div>
      <div class="field"><label>Ad</label><input id="f_title" value="${movie ? escapeAttr(movie.title) : ""}" /></div>
      <div class="field"><label>Orijinal ad (istəyə bağlı)</label><input id="f_original_title" value="${movie ? escapeAttr(movie.original_title || "") : ""}" /></div>
      <div class="field"><label>Poster linki</label><input id="f_poster" value="${movie ? escapeAttr(movie.poster_url) : ""}" placeholder="https://..." /></div>
      <div class="field-row">
        <div class="field"><label>İl</label><input id="f_year" type="number" value="${movie ? movie.release_year || "" : ""}" /></div>
        <div class="field"><label>IMDb reytinqi</label><input id="f_imdb" type="number" step="0.1" value="${movie ? movie.imdb_rating || "" : ""}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ölkə</label><input id="f_country" value="${movie ? escapeAttr(movie.country || "") : ""}" /></div>
        <div class="field"><label>Müddət (dəq)</label><input id="f_runtime" type="number" value="${movie ? movie.runtime_minutes || "" : ""}" /></div>
      </div>
      <div class="field"><label>Rejissor</label><input id="f_director" value="${movie ? escapeAttr(movie.director || "") : ""}" /></div>
      <div class="field"><label>Aktyorlar</label><input id="f_actors" value="${movie ? escapeAttr(movie.actors || "") : ""}" /></div>
      <div class="field"><label>Qısa təsvir</label><textarea id="f_desc">${movie ? escapeHtml(movie.short_description || "") : ""}</textarea></div>
      <div class="field"><label>MitoFilm rəyi</label><textarea id="f_review">${movie ? escapeHtml(movie.mito_review || "") : ""}</textarea></div>
      <div class="field"><label>Treyler linki (istəyə bağlı)</label><input id="f_trailer" value="${movie ? escapeAttr(movie.trailer_url || "") : ""}" /></div>
      <div class="field"><label>Rəsmi izləmə linki</label><input id="f_watch" value="${movie ? escapeAttr(movie.official_watch_url) : ""}" /></div>
      <div class="field">
        <label>Tövsiyə olunan gün</label>
        <div class="day-pills" id="dayPills">${dayPills}</div>
      </div>
      <div class="field"><label>Saat (istəyə bağlı)</label><input id="f_time" value="${movie ? escapeAttr(movie.recommended_time || "") : ""}" placeholder="məs: 21:00" /></div>
      <button id="saveMovieBtn" class="btn btn-gold" style="width:100%">${movie ? "Yadda saxla" : "Əlavə et"}</button>
      <div class="msg-box" id="movieMsg"></div>
    </div>`;

  document.getElementById("modalOverlay").classList.add("open");
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);

  document.querySelectorAll(".day-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDay = btn.getAttribute("data-day");
      document.querySelectorAll(".day-pill").forEach((b) => b.classList.toggle("selected", b === btn));
    });
  });

  document.getElementById("saveMovieBtn").addEventListener("click", () => saveMovie(movie ? movie.id : null));
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

async function saveMovie(id) {
  const msg = document.getElementById("movieMsg");
  const payload = {
    week_id: STATE.week.id,
    genre_id: Number(document.getElementById("f_genre").value),
    title: document.getElementById("f_title").value.trim(),
    original_title: document.getElementById("f_original_title").value.trim(),
    poster_url: document.getElementById("f_poster").value.trim(),
    release_year: document.getElementById("f_year").value,
    imdb_rating: document.getElementById("f_imdb").value,
    country: document.getElementById("f_country").value.trim(),
    runtime_minutes: document.getElementById("f_runtime").value,
    director: document.getElementById("f_director").value.trim(),
    actors: document.getElementById("f_actors").value.trim(),
    short_description: document.getElementById("f_desc").value.trim(),
    mito_review: document.getElementById("f_review").value.trim(),
    trailer_url: document.getElementById("f_trailer").value.trim(),
    official_watch_url: document.getElementById("f_watch").value.trim(),
    recommended_day: selectedDay,
    recommended_time: document.getElementById("f_time").value.trim(),
  };

  if (!payload.title || !payload.poster_url || !payload.official_watch_url) {
    msg.textContent = "Ad, poster və izləmə linki mütləqdir.";
    return;
  }

  try {
    if (id) {
      const data = await api(`/api/admin-movie?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const idx = STATE.movies.findIndex((m) => m.id === id);
      STATE.movies[idx] = { ...STATE.movies[idx], ...data.movie };
    } else {
      const data = await api("/api/admin-movie", { method: "POST", body: JSON.stringify(payload) });
      STATE.movies.push(data.movie);
    }
    closeModal();
    render();
    showToast(id ? "Yeniləndi ✅" : "Əlavə olundu ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function saveSitePrices() {
  const msg = document.getElementById("sitePricesMsg");
  const payload = {
    price_genre_day: document.getElementById("p_genre_day").value,
    price_genre_week: document.getElementById("p_genre_week").value,
    price_genre_month: document.getElementById("p_genre_month").value,
    price_mixed_day: document.getElementById("p_mixed_day").value,
    price_mixed_week: document.getElementById("p_mixed_week").value,
    price_mixed_month: document.getElementById("p_mixed_month").value,
  };
  try {
    await api("/api/admin-prices", { method: "POST", body: JSON.stringify(payload) });
    showToast("Qiymətlər yeniləndi ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function saveBotPrices() {
  const msg = document.getElementById("botPricesMsg");
  const payload = {
    price_genre: document.getElementById("p_bot_genre").value,
    price_mixed: document.getElementById("p_bot_mixed").value,
  };
  try {
    await api("/api/admin-prices", { method: "POST", body: JSON.stringify(payload) });
    showToast("Qiymətlər yeniləndi ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

init();
