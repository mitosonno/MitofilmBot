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

function showContactForm(planId) {
  document.getElementById("content").innerHTML = `
    <h2 style="margin-bottom:6px;">Bir addım qalıb</h2>
    <p style="color:var(--muted);font-size:14px;margin-bottom:20px;">Qəbzin və tövsiyələrin email-ə düşsün deyə, yaz:</p>
    <div class="field" style="text-align:left;"><label>Email</label><input id="contact_email" type="email" placeholder="sen@example.com" /></div>
    <div class="field" style="text-align:left;"><label>Telefon (istəyə bağlı)</label><input id="contact_phone" placeholder="+994..." /></div>
    <button id="contactSubmitBtn" class="btn btn-gold" style="width:100%">Davam et</button>
    <div class="msg-box" id="contactMsg"></div>`;

  document.getElementById("contactSubmitBtn").addEventListener("click", async () => {
    const email = document.getElementById("contact_email").value.trim();
    const phone = document.getElementById("contact_phone").value.trim();
    const msg = document.getElementById("contactMsg");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Düzgün email yaz.";
      return;
    }
    await createOrder(planId, { email, phone });
  });
}

async function start() {
  const planId = getParam("plan");
  if (!planId) {
    showError("Plan tapılmadı.");
    return;
  }
  await createOrder(planId);
}

async function createOrder(planId, extra) {
  try {
    const res = await fetch("/api/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, telegramUserId: getTelegramUserId(), ...(extra || {}) }),
    });
    const data = await res.json();

    if (data.needsContact) {
      showContactForm(planId);
      return;
    }

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
