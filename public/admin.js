const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
const INIT_DATA = tg ? tg.initData : "";
let ADMIN_PASSWORD = sessionStorage.getItem("mito_admin_pw") || "";

const DAYS = [
  "Bazar ertəsi",
  "Çərşənbə axşamı",
  "Çərşənbə",
  "Cümə axşamı",
  "Cümə",
  "Şənbə",
  "Bazar",
];

let STATE = null; // { genres, plans, botPrices, personaStyle, promoCodes }
let currentGenre = undefined; // null = qarışıq, rəqəm = janr id
let currentPlan = null;
let currentPlanMovies = [];
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
      "X-Admin-Password": ADMIN_PASSWORD,
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

// ============== GİRİŞ: Telegram + şifrə ==============

async function init() {
  const gate = document.getElementById("gate");
  if (!INIT_DATA) {
    gate.textContent = "Bu səhifə yalnız Telegram daxilində açılır.";
    return;
  }
  if (!ADMIN_PASSWORD) {
    showPasswordPrompt();
    return;
  }
  await tryLoadState();
}

function showPasswordPrompt() {
  const gate = document.getElementById("gate");
  gate.innerHTML = `
    <div style="max-width:280px;margin:0 auto;">
      <p style="margin-bottom:14px;">Admin panelinə keçmək üçün şifrəni yaz:</p>
      <div class="field"><input type="password" id="adminPwInput" placeholder="Şifrə" /></div>
      <button id="pwSubmitBtn" class="btn btn-gold" style="width:100%">Daxil ol</button>
      <div class="msg-box" id="pwMsg"></div>
    </div>`;
  document.getElementById("pwSubmitBtn").addEventListener("click", async () => {
    ADMIN_PASSWORD = document.getElementById("adminPwInput").value;
    await tryLoadState();
  });
}

async function tryLoadState() {
  const gate = document.getElementById("gate");
  gate.style.display = "block";
  document.getElementById("adminRoot").style.display = "none";
  try {
    STATE = await api("/api/admin-state");
    sessionStorage.setItem("mito_admin_pw", ADMIN_PASSWORD);
    gate.style.display = "none";
    document.getElementById("adminRoot").style.display = "block";
    renderHome();
  } catch (e) {
    ADMIN_PASSWORD = "";
    sessionStorage.removeItem("mito_admin_pw");
    showPasswordPrompt();
    const msg = document.getElementById("pwMsg");
    if (msg) msg.textContent = e.message;
  }
}

// ============== ANA EKRAN: janrlar siyahısı ==============

function renderHome() {
  currentGenre = undefined;
  currentPlan = null;
  const root = document.getElementById("adminRoot");
  root.innerHTML = `
    <div class="admin-card">
      <h2>Janrlar</h2>
      ${genresListHtml()}
    </div>
    <div class="admin-card">
      <h2>Yeni janr əlavə et</h2>
      <div class="field"><input id="new_genre_name" placeholder="məs: Fantaziya" /></div>
      <button id="createGenreBtn" class="btn btn-gold">+ Janr əlavə et</button>
      <div class="msg-box" id="newGenreMsg"></div>
    </div>
    <div class="admin-card">
      <h2>Bot qiymətləri (Telegram-ın köhnə mətn menyusu)</h2>
      ${botPricesFormHtml()}
    </div>
    <div class="admin-card">
      <h2>MitoFilm-in səsi</h2>
      <p style="color:var(--muted);font-size:13px;margin-top:-8px;">
        Bura yazdıqların AI-nin söhbət tərzinə əlavə olunur — nə qədər çox nümunə/qeyd yazsan,
        bir o qədər sənin istədiyin kimi səslənər. İstənilən vaxt dəyişə bilərsən.
      </p>
      ${personaFormHtml()}
    </div>
    <div class="admin-card">
      <h2>Promo kodlar</h2>
      ${promoFormHtml()}
      ${promoListHtml()}
    </div>
  `;
  wireHomeEvents();
}

function genresListHtml() {
  const rows = STATE.genres
    .map((g) => {
      const count = STATE.plans.filter((p) => p.genre_id === g.id).length;
      return `
      <div class="admin-movie-row genre-row" data-genre-id="${g.id}">
        <div class="info"><div><div class="name">${escapeHtml(g.name_az)}</div><div class="sub">${count} plan</div></div></div>
        <div style="color:var(--muted)">→</div>
      </div>`;
    })
    .join("");

  const mixedCount = STATE.plans.filter((p) => p.genre_id === null).length;
  const mixedRow = `
    <div class="admin-movie-row genre-row" data-genre-id="">
      <div class="info"><div><div class="name">Qarışıq</div><div class="sub">${mixedCount} plan</div></div></div>
      <div style="color:var(--muted)">→</div>
    </div>`;

  return rows + mixedRow;
}

function botPricesFormHtml() {
  const p = STATE.botPrices;
  return `
    <div class="field-row">
      <div class="field"><label>Janr üzrə</label><input id="p_bot_genre" type="number" step="0.01" value="${escapeAttr(p.genre)}" /></div>
      <div class="field"><label>Qarışıq</label><input id="p_bot_mixed" type="number" step="0.01" value="${escapeAttr(p.mixed)}" /></div>
    </div>
    <button id="saveBotPricesBtn" class="btn btn-gold">Yadda saxla</button>
    <div class="msg-box" id="botPricesMsg"></div>`;
}

function personaFormHtml() {
  return `
    <div class="field">
      <textarea id="personaStyle" rows="5" placeholder="məs: Həmişə emoji istifadə et. Qısa cümlələr yaz...">${escapeHtml(STATE.personaStyle)}</textarea>
    </div>
    <button id="savePersonaBtn" class="btn btn-gold">Yadda saxla</button>
    <div class="msg-box" id="personaMsg"></div>`;
}

function promoFormHtml() {
  return `
    <div class="field-row">
      <div class="field"><label>Kod</label><input id="promo_code" placeholder="məs: TEST2026" style="text-transform:uppercase;" /></div>
      <div class="field"><label>Endirim (%)</label><input id="promo_discount" type="number" value="100" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Maks. istifadə (boş = limitsiz)</label><input id="promo_max_uses" type="number" placeholder="limitsiz" /></div>
      <div class="field"><label>Bitmə tarixi (istəyə bağlı)</label><input id="promo_expires" type="date" /></div>
    </div>
    <button id="createPromoBtn" class="btn btn-gold">+ Promo kod yarat</button>
    <div class="msg-box" id="promoMsg"></div>`;
}

function promoListHtml() {
  if (!STATE.promoCodes || STATE.promoCodes.length === 0) {
    return `<p style="color:var(--muted);font-size:14px;margin-top:14px;">Hələ promo kod yoxdur.</p>`;
  }
  return `<div style="margin-top:18px;">${STATE.promoCodes
    .map(
      (p) => `
    <div class="admin-movie-row">
      <div class="info">
        <div>
          <div class="name">${escapeHtml(p.code)} <span style="color:var(--muted);font-weight:500;">— ${p.discount_percent}% endirim</span></div>
          <div class="sub">${p.used_count}${p.max_uses ? "/" + p.max_uses : ""} istifadə olunub · ${p.is_active ? "✅ aktiv" : "⏸ deaktiv"}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="icon-btn toggle-promo" data-id="${p.id}">${p.is_active ? "Deaktiv et" : "Aktiv et"}</button>
        <button class="icon-btn del-promo" data-id="${p.id}">Sil</button>
      </div>
    </div>`
    )
    .join("")}</div>`;
}

function wireHomeEvents() {
  document.querySelectorAll(".genre-row").forEach((row) => {
    row.addEventListener("click", () => {
      const val = row.getAttribute("data-genre-id");
      openGenre(val === "" ? null : Number(val));
    });
  });
  document.getElementById("createGenreBtn").addEventListener("click", createGenre);
  document.getElementById("saveBotPricesBtn").addEventListener("click", saveBotPrices);
  document.getElementById("savePersonaBtn").addEventListener("click", savePersona);
  document.getElementById("createPromoBtn").addEventListener("click", createPromo);
  document.querySelectorAll(".toggle-promo").forEach((b) =>
    b.addEventListener("click", () => togglePromo(b.getAttribute("data-id")))
  );
  document.querySelectorAll(".del-promo").forEach((b) =>
    b.addEventListener("click", () => deletePromo(b.getAttribute("data-id")))
  );
}

async function createGenre() {
  const msg = document.getElementById("newGenreMsg");
  const name = document.getElementById("new_genre_name").value.trim();
  if (!name) {
    msg.textContent = "Ad yaz.";
    return;
  }
  try {
    await api("/api/admin-actions", { method: "POST", body: JSON.stringify({ action: "create_genre", name_az: name }) });
    STATE = await api("/api/admin-state");
    renderHome();
    showToast("Janr əlavə olundu ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function saveBotPrices() {
  const msg = document.getElementById("botPricesMsg");
  try {
    await api("/api/admin-actions", {
      method: "POST",
      body: JSON.stringify({
        action: "update_bot_prices",
        price_genre: document.getElementById("p_bot_genre").value,
        price_mixed: document.getElementById("p_bot_mixed").value,
      }),
    });
    showToast("Qiymətlər yeniləndi ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function savePersona() {
  const msg = document.getElementById("personaMsg");
  try {
    await api("/api/admin-actions", {
      method: "POST",
      body: JSON.stringify({ action: "update_persona", persona_style: document.getElementById("personaStyle").value }),
    });
    STATE.personaStyle = document.getElementById("personaStyle").value;
    showToast("Yadda saxlandı ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function createPromo() {
  const msg = document.getElementById("promoMsg");
  const code = document.getElementById("promo_code").value.trim();
  const discount = document.getElementById("promo_discount").value;
  const maxUses = document.getElementById("promo_max_uses").value;
  const expires = document.getElementById("promo_expires").value;

  if (!code) {
    msg.textContent = "Kod yaz.";
    return;
  }

  try {
    await api("/api/admin-actions", {
      method: "POST",
      body: JSON.stringify({
        action: "create_promo",
        code,
        discount_percent: discount,
        max_uses: maxUses || null,
        expires_at: expires ? new Date(expires).toISOString() : null,
      }),
    });
    STATE = await api("/api/admin-state");
    renderHome();
    showToast("Promo kod yaradıldı ✅");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function togglePromo(id) {
  try {
    await api("/api/admin-actions", { method: "POST", body: JSON.stringify({ action: "toggle_promo", promo_id: id }) });
    STATE = await api("/api/admin-state");
    renderHome();
  } catch (e) {
    showToast(e.message);
  }
}

async function deletePromo(id) {
  const ok = await confirmDialog("Bu promo kodu silmək istəyirsən?");
  if (!ok) return;
  try {
    await api("/api/admin-actions", { method: "POST", body: JSON.stringify({ action: "delete_promo", promo_id: id }) });
    STATE = await api("/api/admin-state");
    renderHome();
    showToast("Silindi");
  } catch (e) {
    showToast(e.message);
  }
}

// ============== JANR EKRANI: o janrın planları ==============

function openGenre(genreId) {
  currentGenre = genreId;
  renderGenreScreen();
}

function renderGenreScreen() {
  const root = document.getElementById("adminRoot");
  const genreName =
    currentGenre === null ? "Qarışıq" : (STATE.genres.find((g) => g.id === currentGenre) || {}).name_az || "";
  const plans = STATE.plans.filter((p) => p.genre_id === currentGenre);

  const rows = plans
    .map(
      (p) => `
    <div class="admin-movie-row">
      <div class="info">
        <div>
          <div class="name">${escapeHtml(p.title)}</div>
          <div class="sub">${p.price} ${escapeHtml(p.currency)} · ${p.movieCount} film · ${p.status === "published" ? "✅ yayımlanıb" : "🕓 qaralama"}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="icon-btn open-plan" data-id="${p.id}">İdarə et</button>
        <button class="icon-btn del-plan" data-id="${p.id}">Sil</button>
      </div>
    </div>`
    )
    .join("");

  root.innerHTML = `
    <button class="icon-btn" id="backHomeBtn" style="margin-bottom:16px;">← Bütün janrlar</button>
    <div class="admin-card">
      <h2>${escapeHtml(genreName)}</h2>
      <div class="field"><label>Yeni plan adı</label><input id="np_title" placeholder="məs: 1 film / 7 film / 30 film / İstənilən ad" /></div>
      <div class="field"><label>Qiymət (AZN)</label><input id="np_price" type="number" step="0.01" placeholder="məs: 3.00" /></div>
      <button id="createPlanBtn" class="btn btn-gold">+ Plan yarat</button>
      <div class="msg-box" id="newPlanMsg"></div>
    </div>
    <div class="admin-card">
      <h2>Planlar (${plans.length})</h2>
      ${rows || '<p style="color:var(--muted);font-size:14px;">Hələ plan yoxdur.</p>'}
    </div>
  `;

  document.getElementById("backHomeBtn").addEventListener("click", renderHome);
  document.getElementById("createPlanBtn").addEventListener("click", createPlanInGenre);
  document.querySelectorAll(".open-plan").forEach((b) =>
    b.addEventListener("click", () => openPlan(b.getAttribute("data-id")))
  );
  document.querySelectorAll(".del-plan").forEach((b) =>
    b.addEventListener("click", () => deletePlan(b.getAttribute("data-id")))
  );
}

async function createPlanInGenre() {
  const msg = document.getElementById("newPlanMsg");
  const title = document.getElementById("np_title").value.trim();
  const price = document.getElementById("np_price").value;

  if (!title || !price) {
    msg.textContent = "Ad və qiyməti doldur.";
    return;
  }

  const btn = document.getElementById("createPlanBtn");
  btn.disabled = true;

  try {
    const data = await api("/api/admin-actions", {
      method: "POST",
      body: JSON.stringify({
        action: "create_plan",
        genre_id: currentGenre === null ? "" : currentGenre,
        title,
        price,
      }),
    });
    STATE = await api("/api/admin-state");
    showToast("Plan yaradıldı ✅");
    openPlan(data.plan.id);
  } catch (e) {
    msg.textContent = e.message;
    btn.disabled = false;
  }
}

async function deletePlan(id) {
  const ok = await confirmDialog("Bu planı və içindəki bütün filmləri silmək istəyirsən?");
  if (!ok) return;
  try {
    await api("/api/admin-actions", { method: "POST", body: JSON.stringify({ action: "delete_plan", plan_id: id }) });
    STATE = await api("/api/admin-state");
    renderGenreScreen();
    showToast("Plan silindi");
  } catch (e) {
    showToast(e.message);
  }
}

// ============== PLAN EKRANI: planın filmləri ==============

async function openPlan(planId) {
  currentPlan = STATE.plans.find((p) => p.id === planId);
  if (!currentPlan) return;
  currentGenre = currentPlan.genre_id;

  const root = document.getElementById("adminRoot");
  root.innerHTML = `<div class="admin-card"><p style="color:var(--muted)">Yüklənir...</p></div>`;

  try {
    const data = await api(`/api/admin-movie?plan_id=${encodeURIComponent(planId)}`);
    currentPlanMovies = data.movies;
  } catch (e) {
    currentPlanMovies = [];
  }

  renderPlanScreen();
}

function renderPlanScreen() {
  const root = document.getElementById("adminRoot");
  const rows = currentPlanMovies
    .map(
      (m) => `
    <div class="admin-movie-row">
      <div class="info">
        ${m.poster_url ? `<img src="${escapeAttr(m.poster_url)}" />` : `<span class="movie-thumb-fallback"></span>`}
        <div>
          <div class="name">${escapeHtml(m.title)}</div>
          <div class="sub">${m.recommended_day ? escapeHtml(m.recommended_day) + (m.recommended_time ? " · " + escapeHtml(m.recommended_time) : "") : ""}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="icon-btn edit-movie" data-id="${m.id}">Redaktə</button>
        <button class="icon-btn del-movie" data-id="${m.id}">Sil</button>
      </div>
    </div>`
    )
    .join("");

  root.innerHTML = `
    <button class="icon-btn" id="backGenreBtn" style="margin-bottom:16px;">← Geri</button>
    <div class="admin-card">
      <h2>${escapeHtml(currentPlan.title)}</h2>
      <p style="color:var(--muted);font-size:14px;margin-top:-8px;">${currentPlan.price} ${escapeHtml(currentPlan.currency)} · ${currentPlan.status === "published" ? "✅ yayımlanıb" : "🕓 qaralama"}</p>
      <div class="form-actions">
        ${
          currentPlan.status === "published"
            ? `<button id="unpublishBtn" class="btn btn-ghost">Qaralamaya qaytar</button>`
            : `<button id="publishBtn" class="btn btn-gold">📢 Planı yayımla</button>`
        }
      </div>
      <div class="msg-box" id="planMsg"></div>
    </div>
    <div class="admin-card">
      <h2>Filmlər (${currentPlanMovies.length})</h2>
      ${rows || '<p style="color:var(--muted);font-size:14px;">Hələ film yoxdur.</p>'}
      <div class="form-actions">
        <button id="addMovieBtn" class="btn btn-gold">+ Film əlavə et</button>
      </div>
    </div>
  `;

  document.getElementById("backGenreBtn").addEventListener("click", async () => {
    STATE = await api("/api/admin-state");
    renderGenreScreen();
  });

  const pubBtn = document.getElementById("publishBtn");
  if (pubBtn) pubBtn.addEventListener("click", () => togglePublish(true));
  const unpubBtn = document.getElementById("unpublishBtn");
  if (unpubBtn) unpubBtn.addEventListener("click", () => togglePublish(false));

  document.getElementById("addMovieBtn").addEventListener("click", () => openMovieModal(null));
  document.querySelectorAll(".edit-movie").forEach((b) =>
    b.addEventListener("click", () => {
      const movie = currentPlanMovies.find((m) => m.id === b.getAttribute("data-id"));
      openMovieModal(movie);
    })
  );
  document.querySelectorAll(".del-movie").forEach((b) =>
    b.addEventListener("click", () => deleteMovie(b.getAttribute("data-id")))
  );
}

async function togglePublish(publish) {
  const msg = document.getElementById("planMsg");
  if (publish && currentPlanMovies.length === 0) {
    msg.textContent = "Əvvəlcə ən azı 1 film əlavə et.";
    return;
  }
  try {
    await api("/api/admin-actions", {
      method: "POST",
      body: JSON.stringify({ action: publish ? "publish_plan" : "unpublish_plan", plan_id: currentPlan.id }),
    });
    currentPlan.status = publish ? "published" : "draft";
    STATE = await api("/api/admin-state");
    currentPlan = STATE.plans.find((p) => p.id === currentPlan.id);
    renderPlanScreen();
    showToast(publish ? "Plan yayımlandı ✅" : "Qaralamaya qaytarıldı");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function deleteMovie(id) {
  const ok = await confirmDialog("Bu filmi silmək istəyirsən?");
  if (!ok) return;
  try {
    await api(`/api/admin-movie?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    currentPlanMovies = currentPlanMovies.filter((m) => m.id !== id);
    renderPlanScreen();
    showToast("Silindi");
  } catch (e) {
    showToast(e.message);
  }
}

// ============== FİLM FORMASI (modal) — poster yükləmə daxil ==============

function resizeImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Şəkil oxuna bilmədi"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Şəkil oxuna bilmədi"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePosterFile(file) {
  const preview = document.getElementById("posterPreview");
  preview.textContent = "Yüklənir...";
  try {
    const base64 = await resizeImage(file, 700);
    preview.innerHTML = `<img src="${base64}" style="width:80px;border-radius:6px;" />`;
    const data = await api("/api/admin-upload", {
      method: "POST",
      body: JSON.stringify({ imageBase64: base64, filename: file.name, contentType: "image/jpeg" }),
    });
    document.getElementById("f_poster").value = data.url;
    preview.innerHTML += ` <span style="color:#8fd19e;font-size:12px;">✅ Yükləndi</span>`;
  } catch (e) {
    preview.innerHTML = `<span style="color:var(--rose);font-size:12px;">${escapeHtml(e.message)}</span>`;
  }
}

function openMovieModal(movie) {
  selectedDay = movie ? movie.recommended_day : null;

  const dayPills = DAYS.map(
    (d) => `<button type="button" class="day-pill ${d === selectedDay ? "selected" : ""}" data-day="${escapeAttr(d)}">${escapeHtml(d)}</button>`
  ).join("");

  document.getElementById("modalSheet").innerHTML = `
    <button class="modal-close" id="modalCloseBtn">✕</button>
    <div class="modal-body">
      <h3 style="margin-top:0">${movie ? "Filmi redaktə et" : "Yeni film"}</h3>
      <div class="field"><label>Ad</label><input id="f_title" value="${movie ? escapeAttr(movie.title) : ""}" /></div>
      <div class="field"><label>Orijinal ad (istəyə bağlı)</label><input id="f_original_title" value="${movie ? escapeAttr(movie.original_title || "") : ""}" /></div>
      <div class="field">
        <label>Poster</label>
        <input type="file" id="f_poster_file" accept="image/*" />
        <div id="posterPreview" style="margin-top:8px;">${movie && movie.poster_url ? `<img src="${escapeAttr(movie.poster_url)}" style="width:80px;border-radius:6px;" />` : ""}</div>
        <input type="hidden" id="f_poster" value="${movie ? escapeAttr(movie.poster_url) : ""}" />
      </div>
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

  document.getElementById("f_poster_file").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handlePosterFile(e.target.files[0]);
  });

  document.querySelectorAll(".day-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDay = btn.getAttribute("data-day");
      document.querySelectorAll(".day-pill").forEach((b) => b.classList.toggle("selected", b === btn));
    });
  });

  // Vacib: düymə YALNIZ BİR DƏFƏ işə düşsün deyə, kliklənən kimi dərhal deaktiv edirik —
  // əks halda tələsik ikinci klik eyni filmi TƏKRAR əlavə edə bilər.
  const saveBtn = document.getElementById("saveMovieBtn");
  saveBtn.addEventListener("click", () => saveMovie(movie ? movie.id : null, saveBtn));
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

async function saveMovie(id, btn) {
  if (btn.disabled) return;

  const msg = document.getElementById("movieMsg");
  const payload = {
    plan_id: currentPlan.id,
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

  btn.disabled = true;

  try {
    if (id) {
      const data = await api(`/api/admin-movie?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const idx = currentPlanMovies.findIndex((m) => m.id === id);
      currentPlanMovies[idx] = data.movie;
    } else {
      const data = await api("/api/admin-movie", { method: "POST", body: JSON.stringify(payload) });
      currentPlanMovies.push(data.movie);
    }
    closeModal();
    renderPlanScreen();
    showToast(id ? "Yeniləndi ✅" : "Əlavə olundu ✅");
  } catch (e) {
    msg.textContent = e.message;
    btn.disabled = false;
  }
}

init();
