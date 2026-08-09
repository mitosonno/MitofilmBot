-- MitoFilm — Müddətli tövsiyə planları (1 günlük / 7 günlük / 1 aylıq).
-- Bunu Supabase SQL Editor-da, əvvəlki 2 migration-dan SONRA işə sal.

alter table subscriptions add column if not exists duration text not null default 'week';

insert into settings (key, value) values
  ('price_genre_day', '1.00'),
  ('price_genre_week', '3.00'),
  ('price_genre_month', '8.00'),
  ('price_mixed_day', '1.50'),
  ('price_mixed_week', '5.00'),
  ('price_mixed_month', '12.00')
on conflict (key) do nothing;
