-- MitoFilm — Hər film üçün tövsiyə olunan gün/saat.
-- Bunu Supabase SQL Editor-da, əvvəlki migration-lardan SONRA işə sal.

alter table movies add column if not exists recommended_day text;
alter table movies add column if not exists recommended_time text;
