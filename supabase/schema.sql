-- ====================================================================
-- YDS KELİME UYGULAMASI - SUPABASE VERİTABANI ŞEMASI
-- ====================================================================
-- Bu SQL dosyasını Supabase Dashboard -> SQL Editor alanına yapıştırıp
-- "RUN" butonuna basarak tüm tabloları ve indeksleri tek seferde oluşturabilirsiniz.
-- ====================================================================

-- 1. KELİMELER TABLOSU (words)
create table if not exists public.words (
  id text primary key,
  user_id text not null,
  term text not null,
  definition text not null,
  part_of_speech text not null,
  synonyms jsonb not null default '[]'::jsonb,
  antonyms jsonb not null default '[]'::jsonb,
  collocations jsonb not null default '[]'::jsonb,
  sentences jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  difficulty integer not null default 2,
  notes text,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create index if not exists idx_words_user_updated on public.words (user_id, updated_at);
create index if not exists idx_words_user_term on public.words (user_id, term);

-- 2. FSRS KART DURUMLARI (card_states)
create table if not exists public.card_states (
  id text primary key,
  word_id text not null,
  user_id text not null,
  state integer not null default 0,
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  mastery_score integer not null default 1,
  last_review timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_card_states_user_due on public.card_states (user_id, due);

-- 3. TEKRAR GEÇMİŞİ LOGLARI (review_logs)
create table if not exists public.review_logs (
  id text primary key,
  word_id text not null,
  user_id text not null,
  rating integer not null,
  state integer not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  last_elapsed_days integer not null,
  scheduled_days integer not null,
  reviewed_at timestamptz not null,
  duration_ms integer not null default 0,
  question_type text not null default 'flashcard'
);

create index if not exists idx_review_logs_user_reviewed on public.review_logs (user_id, reviewed_at);

-- 4. KAPSAMLI UYGULAMA LOGLARI (app_logs)
-- Sistem hataları, kullanıcı etkileşimleri, uyarılar ve analiz verileri
create table if not exists public.app_logs (
  id text primary key,
  user_id text,
  level text not null,
  category text not null,
  message text not null,
  details jsonb,
  device_info jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists idx_app_logs_timestamp on public.app_logs (timestamp desc);
create index if not exists idx_app_logs_level on public.app_logs (level);
create index if not exists idx_app_logs_user on public.app_logs (user_id);

-- ====================================================================
-- GÜVENLİK (ROW LEVEL SECURITY - RLS)
-- ====================================================================
-- Uygulama kişisel olduğu ve anonim anahtarla (anon key) senkronize
-- olduğu için RLS'i etkinleştirip anon rolüne tam erişim veriyoruz:

alter table public.words enable row level security;
alter table public.card_states enable row level security;
alter table public.review_logs enable row level security;
alter table public.app_logs enable row level security;

-- Anon erişim politikaları:
create policy "Allow all operations for words" on public.words
  for all using (true) with check (true);

create policy "Allow all operations for card_states" on public.card_states
  for all using (true) with check (true);

create policy "Allow all operations for review_logs" on public.review_logs
  for all using (true) with check (true);

create policy "Allow all operations for app_logs" on public.app_logs
  for all using (true) with check (true);
