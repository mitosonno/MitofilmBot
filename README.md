# MitoFilm — Telegram Bot

100% Azərbaycan dilində kino tövsiyə platforması. İstifadəçi janr (və ya qarışıq) seçir,
Payriff ilə ödəniş edir, 7 günlük film siyahısını (poster + link + məlumat) alır.
Admin bütün idarəetməni Telegram bot daxilindəki əmrlərlə edir.

**Stack:** Vercel (serverless functions) + Supabase (Postgres) + Payriff (ödəniş) + OpenAI (rəy yazımı üçün, könüllü)

---

## 1. Supabase qurulumu

1. [supabase.com](https://supabase.com) — yeni layihə yarat.
2. **SQL Editor**-a keç, `db/schema.sql` faylının içindəkiləri kopyala və işə sal.
3. **Project Settings > API**-dan bunları götür:
   - `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (bu GİZLİ açardır, heç kimə göstərmə)

## 2. Telegram bot yaratmaq (BotFather)

1. Telegram-da `@BotFather`-ə yaz: `/newbot`
2. Bot üçün ad və username seç (username `bot` ilə bitməlidir, məs: `mitofilm_bot`).
3. BotFather sənə bir **token** verəcək (məs: `123456:AAExxxxx`) → bu `TELEGRAM_BOT_TOKEN`.
4. `TELEGRAM_WEBHOOK_SECRET` üçün özün istənilən uzun təsadüfi mətn uydur (məs: `mito_wh_9x7k2m...`).
5. Öz Telegram id-ni öyrənmək üçün `@userinfobot`-a yaz — çıxan rəqəm sənin admin id-ndir → `ADMIN_TELEGRAM_IDS`.

## 3. Payriff qurulumu

1. [payriff.com](https://payriff.com)-da hesab aç, telefon təsdiqindən keç.
2. Merchant (biznes hesabı və ya birdəfəlik ödəniş üçün fərdi seçim) yarat.
3. **Dashboard > Developers** bölməsindən `merchant id` və `secret key`-i götür.
4. ⚠️ **Vacib:** `lib/payriff.ts` faylı Payriff-in ümumi Gateway API sxeminə əsasən yazılıb.
   Canlıya keçməzdən əvvəl mütləq:
   - Payriff-in test rejimində sınaqdan keçir,
   - `PAYRIFF_BASE_URL`, endpoint yolu (`/api/v3/orders`) və cavab strukturunu
     öz Dashboard-undakı cari sənədlə tutuşdur (kiçik fərqlər ola bilər),
   - Callback URL-i Payriff panelində qeyd et: `https://SİZİN-DOMAIN.vercel.app/api/payriff-callback`

## 4. OpenAI (könüllü — admin "ai" yazanda film rəyi avtomatik yazılır)

`platform.openai.com`-dan API key al → `OPENAI_API_KEY`.
Bu addımı keçsən belə bot işləyəcək, sadəcə admin "ai" seçimindən istifadə edə bilməyəcək.

## 5. Email (qəbz + tövsiyələr göndərmək üçün)

Ödəniş təsdiqlənəndə istifadəçinin email-inə avtomatik qəbz + film siyahısı göndərilir.
Bunun üçün Gmail App Password istifadə edə bilərsən:

1. Gmail hesabında 2 addımlı təsdiqi aktivləşdir (myaccount.google.com/security)
2. myaccount.google.com/apppasswords səhifəsinə keç, "MitoFilm" adlı yeni App Password yarat
3. 16 simvollu kodu götür → bu sənin `SMTP_PASS` dəyərindir
4. `SMTP_USER` = sənin Gmail ünvanın, `SMTP_HOST` = smtp.gmail.com, `SMTP_PORT` = 587

Bu addımı keçsən belə sistem işləyəcək, sadəcə email göndərilməyəcək.

## 6. Vercel-ə deploy

```bash
npm install -g vercel
cd mitofilm-bot
vercel
```

Deploy prosesi bitəndən sonra Vercel sənə bir domain verəcək (məs: `mitofilm-bot.vercel.app`).

**Environment Variables** (Vercel Dashboard > Project > Settings > Environment Variables) —
`.env.example` faylındakı BÜTÜN dəyişənləri əlavə et, `PUBLIC_BASE_URL`-i öz Vercel domain-inlə doldur:

```
PUBLIC_BASE_URL=https://mitofilm-bot.vercel.app
```

Sonra yenidən deploy et ki, dəyişənlər aktiv olsun:

```bash
vercel --prod
```

## 7. Webhook-u aktivləşdirmək

Brauzerdə bunu aç (bir dəfə kifayətdir):

```
https://SİZİN-DOMAIN.vercel.app/api/set-webhook
```

`{"ok":true,...}` cavabı gəlsə, bot artıq mesajları qəbul edir.

## 8. "Yeni tövsiyə al" sabit düyməsini aktivləşdirmək

Bu, botun söhbət pəncərəsinin sol-alt küncündə HƏMİŞƏ görünən düymədir və basılanda
sayt Telegram-ın öz daxilində (Mini App kimi, böyüdülə bilən) açılır. Brauzerdə bir dəfə aç:

```
https://SİZİN-DOMAIN.vercel.app/api/set-menu-button
```

`{"ok":true,...}` cavabı gəlsə, hazırdır — Telegram-a qayıdıb bot söhbətinin sol-alt
küncünə bax, "Yeni tövsiyə al" yazısını görməlisən.

## 9. Botdan istifadə

**İstifadəçi tərəfi:**
- `/start` — ilk dəfə yazanda bot ad, telefon (paylaş düyməsi ilə) və email soruşur, sonra əsas menyu açılır
- Söhbətin sol-alt küncündəki **"Yeni tövsiyə al"** düyməsi → sayt Telegram daxilində (Mini App kimi) açılır, janr + plan seçib ödəniş edilir
- Əsas menyudakı köhnə mətn-əsaslı axın (Janra görə seç / Qarışıq) da paralel işləyir
- `/mysubs` — abunəliklərin
- `/help` — kömək

**Admin tərəfi** (yalnız `ADMIN_TELEGRAM_IDS`-də olan id-lər üçün):
- `/admin` yazanda bot birbaşa **Mini App-ın admin panelini** açan düymə göndərir — bütün idarəetmə (həftə yaratmaq, film əlavə/redaktə/silmək, yayımlamaq, qiymətləri dəyişmək) həmin panel daxilində, formalarla edilir
- Admin panel yalnız Telegram-ın rəsmi doğrulama alqoritmi ilə təsdiqlənən, `ADMIN_TELEGRAM_IDS`-də olan istifadəçilər üçün açılır — başqası cəhd etsə "Bu bölmə yalnız admin üçündür" görür
- Botun köhnə mətn-əsaslı admin axını (`/admin` → düymələrlə sual-cavab) da kodda saxlanılıb, ehtiyac olarsa geri qaytarıla bilər


## Layihə strukturu

```
mitofilm-bot/
  api/
    webhook.ts            → Telegram-dan gələn bütün mesajlar
    payriff-callback.ts   → Payriff ödəniş təsdiqi
    set-webhook.ts        → webhook qeydiyyatı (bir dəfəlik)
  lib/
    bot.ts                → istifadəçi axını (menyu, janr seçimi, ödəniş)
    admin.ts               → admin paneli və film əlavə etmə axını
    deliver.ts              → ödəniş sonrası filmlərin göndərilməsi
    payriff.ts               → Payriff inteqrasiyası
    openai.ts                 → AI-assisted film rəyi
    supabase.ts                → verilənlər bazası əlaqəsi
    texts.ts                    → BÜTÜN Azərbaycan dilində mətnlər (mərkəzləşdirilmiş)
  db/
    schema.sql                   → Supabase sxemi
```

## Veb sayt (landing + ödəniş + nəticələr)

`public/` qovluğu tam girişsiz bir veb sayt təqdim edir:

- `public/index.html` — əsas səhifə: bu həftənin biletləri (janr + qarışıq), qiymətlər
- `public/result.html` — ödənişdən sonra istifadəçinin yönləndirildiyi səhifə: ödəniş statusunu yoxlayır, təsdiqlənəndə posterlərlə filmləri göstərir

Bu, Telegram botundan TAM ASILI DEYİL — istifadəçi birbaşa saytda bilet seçir, Payriff ilə ödəyir, nəticəni saytda görür.

**Sayt axını:** istifadəçi əvvəlcə janr (və ya "Qarışıq") seçir, sonra o janr üçün 3 plandan birini seçir:
- **1 günlük** — ən son yayımlanan həftədən 1 seçilmiş film
- **7 günlük** — ən son yayımlanan həftənin bütün filmləri
- **1 aylıq** — son 31 gün ərzində yayımlanmış bütün həftələrin filmləri

Bu planların qiymətlərini Telegram-da `/admin` > "🌐 Sayt qiymətləri" ilə dəyişə bilərsən (bot özü isə ayrıca, sadə həftəlik qiymətlərlə işləyir — "💰 Bot qiymətləri").

**Vacib:** bu funksiya üçün aşağıdakı 4 migration faylını da Supabase SQL Editor-da (schema.sql-dan sonra) sırayla işə salmaq lazımdır:
1. `db/migration_web.sql` — Telegram-sız (veb) sifarişlərə icazə verir
2. `db/migration_plans.sql` — müddətli planlar (1 günlük/7 günlük/1 aylıq) üçün lazımi sütun və qiymətlər
3. `db/migration_contact.sql` — istifadəçi məlumatları (ad/telefon/email) və onboarding üçün
4. `db/migration_schedule.sql` — hər film üçün tövsiyə olunan gün/saat üçün

Sayt eyni Vercel layihəsində, `/` ünvanında avtomatik görünür (əlavə deploy addımı lazım deyil). Telegram Mini App daxilində açılanda (bot düyməsi ilə) istifadəçi avtomatik tanınır, sifariş onun Telegram hesabına bağlanır, və `/history.html` səhifəsindən keçmiş tövsiyələrinə baxa bilir.

**Admin panel (`/admin.html`):** tam funksional idarəetmə paneli — həftə yaratmaq, film əlavə/redaktə/silmək (poster, IMDb, gün/saat və s. daxil), yayımlamaq, bütün qiymətləri dəyişmək. Yalnız Telegram-ın rəsmi `initData` doğrulaması ilə təsdiqlənən admin id-lər daxil ola bilir (bax: `lib/telegramAuth.ts`).

## Növbəti addımlar (istəyə görə genişlənə bilər)

- Ləğv etmə / geri qaytarma axını
- Bir neçə admin arasında paralel iş üçün session-lara TTL əlavə etmək
- Rus/İngilis dili üçün i18n (spesifikasiyada nəzərdə tutulub, hazırda default = AZ)
- Statistika: neçə abunəçi, hansı janr daha çox satılır və s.
