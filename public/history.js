if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s || "";
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("az-AZ", { day: "2-digit", month: "long", year: "numeric" });
}

async function loadHistory() {
  const listRoot = document.getElementById("listRoot");

  const tg = window.Telegram && window.Telegram.WebApp;
  const telegramUserId =
    getParam("tg") || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id);

  if (!telegramUserId) {
    listRoot.innerHTML = `<div class="empty-state">Tarixçəni görmək üçün botun "Yeni tövsiyə al" düyməsi ilə daxil ol.</div>`;
    return;
  }

  try {
    const res = await fetch(`/api/public-history?telegramUserId=${encodeURIComponent(telegramUserId)}`);
    const data = await res.json();

    if (!data.orders || data.orders.length === 0) {
      listRoot.innerHTML = `<div class="empty-state">Hələ heç bir tövsiyə almamısan. Ana səhifədən başla 🎬</div>`;
      return;
    }

    listRoot.innerHTML = `
      <div class="hist-list">
        ${data.orders
          .map(
            (o) => `
          <a href="/result.html?order=${encodeURIComponent(o.id)}" class="hist-item">
            <div class="left">
              <h3>${escapeHtml(o.label)} — ${escapeHtml(o.planTitle)}</h3>
              <span>${formatDate(o.paidAt)}</span>
            </div>
            <div class="right">${o.amount} ${escapeHtml(o.currency)}</div>
          </a>`
          )
          .join("")}
      </div>`;
  } catch (e) {
    listRoot.innerHTML = `<div class="empty-state">Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏</div>`;
  }
}

loadHistory();
