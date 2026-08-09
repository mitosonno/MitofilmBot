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
https://SİZİN-DOMAIN.vercel.app/api/setup
```

`{"ok":true,...}` cavabı gəlsə, bot artıq mesajları qəbul edir.

## 8. "Yeni tövsiyə al" sabit düyməsini aktivləşdirmək

Bu, botun söhbət pəncərəsinin sol-alt küncündə HƏMİŞƏ görünən düymədir və basılanda
sayt Telegram-ın öz daxilində (Mini App kimi, böyüdülə bilən) açılır. Brauzerdə bir dəfə aç:

```
https://SİZİN-DOMAIN.vercel.app/api/setup?action=menu-button
```

`{"ok":true,...}` cavabı gəlsə, hazırdır — Telegram-a qayıdıb bot söhbətinin sol-alt
küncünə bax, "Yeni tövsiyə al" yazısını görməlisən.

## 9. Botdan istifadə

**İstifadəçi tərəfi:**
- `/start` — ilk dəfə yazanda bot ad, telefon (paylaş düyməsi ilə) və email soruşur
- Sonra bot **MitoFilm-in canlı agenti** kimi salamlayır (OpenAI ilə, "necəsən, hansı janrda film istəyirsən" tərzində) — istifadəçi janrı SƏRBƏST YAZA bilər (məs: "qorxu", "bilmirəm") YA DA aşağıdakı düymələrdən seçə bilər
- Janr müəyyən olunan kimi, o janr üçün admin-in yaratdığı **YAYIMLANMIŞ planlar** (məs: "1 film", "7 film", "30 film" — admin nə adlandırıbsa) düymələr şəklində göstərilir
- Plan seçiləndə ödəniş linki göndərilir, ödəniş bitəndə nəticə linki (`result.html`) açılır
- Söhbətin sol-alt küncündəki **"Yeni tövsiyə al"** sabit düyməsi → istənilən vaxt sayt Telegram daxilində (Mini App) açılır, janr+plan seçib bilavasitə ödəniş edilir (agentlə söhbətə ehtiyac olmadan)
- `/mysubs` — abunəliklərin, `/help` — kömək

**Qeyd:** `OPENAI_API_KEY` təyin olunmayıbsa, bot yenə işləyir — sadəcə salamlaşma və janr tanıma sadə (AI-sız) məntiqlə aparılır, daha az "canlı" səslənir.

**Admin tərəfi** (yalnız `ADMIN_TELEGRAM_IDS`-də olan id-lər üçün):
- `/admin` yazanda bot birbaşa **Mini App-ın admin panelini** açan düymə göndərir — bütün idarəetmə (plan yaratmaq, filmlərini idarə etmək, yayımlamaq, silmək) həmin panel daxilində, formalarla edilir
- Admin panel yalnız Telegram-ın rəsmi doğrulama alqoritmi ilə təsdiqlənən, `ADMIN_TELEGRAM_IDS`-də olan istifadəçilər üçün açılır — başqası cəhd etsə "Bu bölmə yalnız admin üçündür" görür


## Layihə strukturu

```
mitofilm-bot/
  api/
    webhook.ts             → Telegram-dan gələn bütün mesajlar
    payriff-callback.ts    → Payriff ödəniş təsdiqi
    setup.ts                → webhook + menu-button qeydiyyatı (bir dəfəlik)
    public-week.ts            → sayt: cari həftə, janrlar, qiymətlər
    public-order.ts            → sayt: sifariş yaratmaq (POST) və statusu yoxlamaq (GET)
    public-history.ts           → sayt: Mini App istifadəçisinin sifariş tarixçəsi
    admin-state.ts                → admin: cari vəziyyət (həftə, filmlər, qiymətlər)
    admin-movie.ts                 → admin: film əlavə/redaktə/silmə
    admin-actions.ts                → admin: yeni həftə, yayımla, qiymətləri yenilə
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

**Vacib:** bu funksiya üçün aşağıdakı 6 migration faylını da Supabase SQL Editor-da (schema.sql-dan sonra) sırayla işə salmaq lazımdır:
1. `db/migration_web.sql` — Telegram-sız (veb) sifarişlərə icazə verir
2. `db/migration_plans.sql` — köhnə müddətli planlar üçün (legacy, botun mətn-menyusu üçün saxlanılır)
3. `db/migration_contact.sql` — istifadəçi məlumatları (ad/telefon/email) və onboarding üçün
4. `db/migration_schedule.sql` — hər film üçün tövsiyə olunan gün/saat üçün
5. `db/migration_plans_v2.sql` — **əsas model**: admin-in özünün yaratdığı Tövsiyə Planları + poster şəkilləri üçün fayl anbarı
6. `db/migration_promo.sql` — promo kodlar (pulsuz/endirimli test girişi) üçün

## Promo kodlar

Admin panelində ("Promo kodlar" bölməsi) admin kod yarada bilər (məs: `TEST2026`, 100% endirim) —
istifadəçi saytda plan seçəndə promo kodu yazıb Payriff-ə ehtiyac olmadan pulsuz nəticəni ala bilir.
Bu, xüsusilə Payriff hələ qurulmayanda tam axını sınamaq üçün faydalıdır. Kodlar limitli istifadə
sayı və bitmə tarixi ilə də təyin oluna bilər.

## MitoFilm-in səsi

Admin panelində bir mətn sahəsi var — bura yazdığın qeydlər (məs: "həmişə 🎬 emoji istifadə et",
"daha qısa yaz") botun salamlaşma və söhbət tərzinə avtomatik əlavə olunur. Bu, həqiqi maşın
öyrənməsi deyil (OpenAI-ın modeli fine-tune olunmur) — sadəcə hər sorğuya əlavə təlimat kimi
göndərilir. Amma praktik nəticə eynidir: nə qədər çox nümunə/qeyd yazsan, bot bir o qədər sənin
istədiyin kimi səslənər, və istənilən vaxt dəyişə bilərsən.

## Tövsiyə Planları (əsas model)

Sayt və admin panel **Plan** əsasında işləyir:

- Admin `/admin.html`-də janr seçib (və ya "Qarışıq"), plana ad verib (məs: "1 günlük", "7 günlük", "VIP paket" — istənilən ad), qiymət təyin edir → plan yaranır
- Admin plana filmlər əlavə edir (poster şəkli birbaşa telefon/komputerdən yüklənir, linkə ehtiyac yoxdur) → hazır olanda "Planı yayımla" basır
- Sayt/Mini App-da istifadəçi janr seçəndə, o janr üçün YAYIMLANMIŞ bütün planlar göstərilir, istifadəçi birini seçib ödəyir
- Bir janrın istənilən sayda planı ola bilər (məs: "Qorxu — 1 film", "Qorxu — 7 film" paralel mövcud ola bilər)
- Admin istənilən planı silə və ya "qaralamaya" qaytara bilər

**Qeyd:** Botun köhnə mətn-əsaslı menyusu (Janra görə seç / Qarışıq — inline düymələrlə) hələ də paralel işləyir, amma köhnə "həftə" sisteminə əsaslanır və admin panel indi onu idarə etmir (`/admin` > "Bot qiymətləri" ilə yalnız onun qiymətini dəyişmək olar). Yeni Plan sistemi ilə heç bir ziddiyyəti yoxdur.

Sayt eyni Vercel layihəsində, `/` ünvanında avtomatik görünür (əlavə deploy addımı lazım deyil). Telegram Mini App daxilində açılanda (bot düyməsi ilə) istifadəçi avtomatik tanınır, sifariş onun Telegram hesabına bağlanır, və `/history.html` səhifəsindən keçmiş tövsiyələrinə baxa bilir.

**Admin panel (`/admin.html`):** tam funksional idarəetmə paneli — janr seç → o janrın planlarını yarat/idarə et,
filmlərini idarə et (poster yükləmə daxil, gün/saat), yayımlamaq, silmək. Yeni janr da əlavə edə bilərsən —
avtomatik həm saytda, həm Telegram botunda görünür. Giriş İKİ QATDA qorunur: Telegram-ın rəsmi
`initData` doğrulaması (yalnız `ADMIN_TELEGRAM_IDS`-dəki hesablar) + `ADMIN_PASSWORD` şifrəsi
(bax: `lib/telegramAuth.ts`). Adi istifadəçilər saytda admin panelə heç bir link/işarə görmür —
ora yalnız botun `/admin` əmri ilə keçilir.

## Növbəti addımlar (istəyə görə genişlənə bilər)

- Ləğv etmə / geri qaytarma axını
- Bir neçə admin arasında paralel iş üçün session-lara TTL əlavə etmək
- Rus/İngilis dili üçün i18n (spesifikasiyada nəzərdə tutulub, hazırda default = AZ)
- Statistika: neçə abunəçi, hansı janr daha çox satılır və s.
