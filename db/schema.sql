-- MitoFilm — Supabase (Postgres) sxemi
-- Bunu Supabase Dashboard > SQL Editor-da işə sal.

create extension if not exists pgcrypto;

-- Janrlar (Azərbaycan dilində)
create table if not exists genres (
  id serial primary key,
  name_az text not null unique
);

insert into genres (name_az) values
  ('Dram'), ('Qorxu'), ('Fantastika'), ('Komediya'), ('Detektiv'),
  ('Kriminal'), ('Triller'), ('Romantika'), ('Aksiyon'), ('Macəra')
on conflict (name_az) do nothing;

-- Həftələr
create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  week_label text not null,           -- məs: "10-16 Avqust"
  status text not null default 'draft', -- draft | published | archived
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Filmlər (hər film konkret həftəyə və janra bağlıdır)
create table if not exists movies (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id) on delete cascade,
  genre_id int not null references genres(id),
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
  mito_review text,               -- MitoFilm-in öz rəyi (AI-assisted ola bilər)
  trailer_url text,
  official_watch_url text not null,
  created_at timestamptz not null default now()
);

-- İstifadəçilər (Telegram)
create table if not exists users (
  id bigint primary key,          -- telegram user id
  username text,
  first_name text,
  created_at timestamptz not null default now()
);

-- Qiymətlər (admin tənzimləyə bilər)
create table if not exists settings (
  key text primary key,
  value text not null
);

insert into settings (key, value) values
  ('price_genre', '3.00'),
  ('price_mixed', '5.00'),
  ('currency', 'AZN')
on conflict (key) do nothing;

-- Abunəliklər / ödənişlər
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id),
  week_id uuid not null references weeks(id),
  genre_id int references genres(id),   -- null = qarışıq (bütün janrlar)
  status text not null default 'pending', -- pending | paid | failed | cancelled
  amount numeric(10,2) not null,
  currency text not null default 'AZN',
  payriff_order_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Admin-in çox addımlı əməliyyatları üçün müvəqqəti sessiya (serverless statesiz olduğu üçün)
create table if not exists admin_sessions (
  admin_id bigint primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_movies_week on movies(week_id);
create index if not exists idx_movies_genre on movies(genre_id);
create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_week on subscriptions(week_id);
