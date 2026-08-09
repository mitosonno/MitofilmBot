-- MitoFilm — Promo kodlar (test/pulsuz giriş üçün).
-- Bunu Supabase SQL Editor-da, əvvəlki bütün migration-lardan SONRA işə sal.

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent int not null default 100,  -- 100 = tam pulsuz
  max_uses int,                                -- boş = limitsiz
  used_count int not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table subscriptions add column if not exists promo_code text;
