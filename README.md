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

## 5. Vercel-ə deploy

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

## 6. Webhook-u aktivləşdirmək

Brauzerdə bunu aç (bir dəfə kifayətdir):

```
https://SİZİN-DOMAIN.vercel.app/api/set-webhook
```

`{"ok":true,...}` cavabı gəlsə, bot artıq mesajları qəbul edir.

## 7. Botdan istifadə

**İstifadəçi tərəfi:**
- `/start` — əsas menyu
- Janra görə seç və ya Qarışıq seç → Ödə → ödəniş linki → ödəniş bitəndə filmlər avtomatik gəlir
- `/mysubs` — abunəliklərin
- `/help` — kömək

**Admin tərəfi** (yalnız `ADMIN_TELEGRAM_IDS`-də olan id-lər üçün):
- `/admin` — admin panel açılır
- **Yeni həftə yarat** → həftənin adını yaz (məs: "10-16 Avqust")
- **Film əlavə et** → janr seç, sonra bot ardıcıl suallar verir (ad, poster linki, il,
  IMDb, ölkə, rejissor, aktyorlar, müddət, təsvir, rəy — "ai" yazsan OpenAI qaralama yazır —
  treyler, rəsmi izləmə linki) → Yadda saxla
- **Bu həftənin filmləri** → siyahını göstərir
- **Həftəni yayımla** → yalnız yayımlandıqdan sonra istifadəçilər ödəniş edib filmlərə çata bilir
- **Qiymətləri dəyiş** → janr üzrə və qarışıq üçün qiymət

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

**Vacib:** bu funksiya üçün `db/migration_web.sql` faylını da Supabase SQL Editor-da (schema.sql-dan sonra) işə salmaq lazımdır — bu, `subscriptions` cədvəlinə Telegram-sız sifarişlərə icazə verir.

Sayt eyni Vercel layihəsində, `/` ünvanında avtomatik görünür (əlavə deploy addımı lazım deyil).

## Növbəti addımlar (istəyə görə genişlənə bilər)

- Ləğv etmə / geri qaytarma axını
- Bir neçə admin arasında paralel iş üçün session-lara TTL əlavə etmək
- Rus/İngilis dili üçün i18n (spesifikasiyada nəzərdə tutulub, hazırda default = AZ)
- Statistika: neçə abunəçi, hansı janr daha çox satılır və s.
