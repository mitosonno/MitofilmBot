-- MitoFilm — Admin-in özünün yaratdığı "Tövsiyə Planları" modeli.
-- Bunu Supabase SQL Editor-da, əvvəlki bütün migration-lardan SONRA işə sal.

-- Planlar: admin hər janr (və ya Qarışıq — genre_id = null) üçün istədiyi qədər
-- plan yarada bilər, hər birinin öz adı, qiyməti və filmləri var.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  genre_id int references genres(id),   -- null = Qarışıq
  title text not null,                   -- admin özü yazır, məs: "1 günlük", "7 günlük", "1 aylıq"
  price numeric(10,2) not null,
  currency text not null default 'AZN',
  status text not null default 'draft',  -- draft | published
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Hər plana aid filmlər (artıq "həftə"yə deyil, birbaşa plana bağlıdır)
create table if not exists plan_movies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  title text not null,
  original_title text,
  poster_url text not null,
  release_year int,
  imdb_rating numeric(3,1),
  country text,
  director text,
  actors text,
  runtime_minutes int,
  short_description text,
  mito_review text,
  trailer_url text,
  official_watch_url text not null,
  recommended_day text,
  recommended_time text,
  created_at timestamptz not null default now()
);

-- Sifarişlərin indi (əsasən) bir plana bağlanması
alter table subscriptions add column if not exists plan_id uuid references plans(id);
alter table subscriptions alter column week_id drop not null;
alter table subscriptions alter column duration drop not null;

-- Poster şəkillərini saxlamaq üçün ictimai (public) fayl anbarı
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

create index if not exists idx_plan_movies_plan on plan_movies(plan_id);
create index if not exists idx_plans_genre on plans(genre_id);
create index if not exists idx_subscriptions_plan on subscriptions(plan_id);
