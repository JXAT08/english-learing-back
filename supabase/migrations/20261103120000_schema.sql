-- EnglishTech: tablas de contenido y de progreso de los estudiantes.
-- El contenido (catálogo, escenarios, niveles…) lo edita solo el equipo.
-- El progreso lo escribe solo el backend; el estudiante únicamente lo lee.

-- ─── Contenido ────────────────────────────────────────────────────────────

create table public.categories (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null check (icon in ('code', 'database', 'shield')),
  tone text not null check (tone in ('violet', 'blue', 'green')),
  position smallint not null unique
);

create table public.words (
  id text primary key,
  category_id text not null references public.categories (id),
  term text not null,
  translation text not null,
  definition text not null,
  definition_es text not null,
  example text not null,
  pronunciation_phrase text not null,
  -- Guía aproximada de pronunciación para hispanohablantes (opcional).
  pronunciation_hint text,
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  synonyms text[] not null default '{}',
  antonyms text[] not null default '{}',
  keywords text[] not null check (cardinality(keywords) > 0),
  position smallint not null,
  unique (category_id, position)
);

create table public.conversation_scenarios (
  id text primary key,
  title text not null,
  description text not null,
  position smallint not null unique
);

create table public.conversation_turns (
  id text primary key,
  scenario_id text not null references public.conversation_scenarios (id) on delete cascade,
  position smallint not null,
  bot_message text not null,
  criteria text[] not null check (cardinality(criteria) > 0),
  -- Sinónimos aceptados por criterio: { "working": ["developing", …] }.
  alternatives jsonb not null default '{}',
  suggestion text not null,
  unique (scenario_id, position)
);

create table public.levels (
  level smallint primary key,
  name text not null,
  minimum_xp integer not null unique check (minimum_xp >= 0)
);

create table public.achievement_definitions (
  id text primary key,
  name text not null,
  description text not null,
  position smallint not null unique
);

create table public.avatars (
  id text primary key,
  label text not null,
  tone text not null check (tone in ('violet', 'blue', 'cyan', 'green', 'amber', 'rose')),
  position smallint not null unique
);

create table public.daily_tips (
  id smallint primary key,
  text text not null
);

-- XP base de cada actividad y cuántas partidas con XP se permiten al día
-- (null = sin tope). Cambiar estos valores no requiere desplegar código.
create table public.activity_rules (
  activity text primary key,
  base_xp integer not null check (base_xp >= 0),
  daily_reward_limit smallint check (daily_reward_limit > 0)
);

-- ─── Datos de cada estudiante ─────────────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 30),
  avatar_id text not null default 'default-student' references public.avatars (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= current_streak),
  last_practice_date date,
  updated_at timestamptz not null default now()
);

create table public.studied_words (
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id text not null references public.words (id),
  source text not null check (source in ('resources', 'practice', 'guest-import')),
  studied_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievement_definitions (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- Una fila por partida terminada. event_id lo genera el frontend: si la
-- petición se reintenta, la partida no se cuenta dos veces.
create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 100),
  activity text not null references public.activity_rules (activity),
  score numeric(4, 3) not null check (score between 0 and 1),
  xp_awarded integer not null check (xp_awarded >= 0),
  correct_count smallint not null check (correct_count >= 0),
  total_count smallint not null check (total_count > 0 and correct_count <= total_count),
  practiced_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Cada respuesta dentro de una partida. De la pronunciación se guarda solo la
-- puntuación: nunca audio ni texto transcrito.
create table public.activity_answers (
  session_id uuid not null references public.activity_sessions (id) on delete cascade,
  position smallint not null check (position >= 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id text references public.words (id),
  turn_id text references public.conversation_turns (id),
  correct boolean not null,
  score smallint check (score between 0 and 100),
  primary key (session_id, position)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sound_enabled boolean not null default true,
  speech_engine text not null default 'auto' check (speech_engine in ('auto', 'browser', 'local')),
  updated_at timestamptz not null default now()
);

-- Consultas frecuentes: historial y tope diario por estudiante.
create index activity_sessions_user_day_idx on public.activity_sessions (user_id, practiced_on, activity);
create index activity_answers_user_idx on public.activity_answers (user_id);
create index words_category_idx on public.words (category_id);
