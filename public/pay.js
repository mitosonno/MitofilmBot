const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getTelegramUserId() {
  try {
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || null;
  } catch (e) {
    return null;
  }
}

function showError(text) {
  document.getElementById("content").innerHTML = `
    <h2>Xəta baş verdi</h2>
    <p style="color:var(--muted)">${text}</p>
    <a href="/" class="btn btn-ghost" style="margin-top:20px;display:inline-block;">Ana səhifəyə qayıt</a>`;
}

async function start() {
  const planId = getParam("plan");
  if (!planId) {
    showError("Plan tapılmadı.");
    return;
  }

  try {
    const res = await fetch("/api/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, telegramUserId: getTelegramUserId() }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.error || "Sifariş yaradıla bilmədi.");
      return;
    }

    if (data.free) {
      window.location.href = `/result.html?order=${encodeURIComponent(data.orderId)}`;
      return;
    }

    window.location.href = data.paymentUrl;
  } catch (e) {
    showError("Nəsə səhv getdi, bir az sonra yenidən cəhd et 🙏");
  }
}

start();
