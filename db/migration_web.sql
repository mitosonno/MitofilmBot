-- MitoFilm — Veb sayt (girişsiz sifariş) üçün əlavə sxem dəyişikliyi.
-- Bunu Supabase SQL Editor-da, əvvəlki schema.sql-dan SONRA işə sal.

alter table subscriptions alter column user_id drop not null;
alter table subscriptions add column if not exists source text not null default 'telegram';
