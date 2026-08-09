-- MitoFilm — İstifadəçi məlumatları (ad, telefon, email) və onboarding sessiyaları.
-- Bunu Supabase SQL Editor-da, əvvəlki migration-lardan SONRA işə sal.

alter table users add column if not exists full_name text;
alter table users add column if not exists phone text;
alter table users add column if not exists email text;

create table if not exists user_sessions (
  user_id bigint primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
