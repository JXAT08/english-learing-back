-- Escritura atómica de una práctica. Las reglas del juego (XP, racha,
-- insignias) se calculan en el backend; esta función solo guarda el resultado
-- en un único paso, para que dos peticiones simultáneas (por ejemplo, un
-- reintento por mala conexión) no sumen XP dos veces.

-- Versión del progreso: el backend la lee, calcula y solo escribe si nadie la
-- cambió entretanto (control de concurrencia optimista).
alter table public.progress add column version integer not null default 0;

create function public.apply_practice(
  p_user_id uuid,
  p_expected_version integer,
  -- { total_xp, current_streak, best_streak, last_practice_date }
  p_progress jsonb,
  -- { event_id, activity, score, xp_awarded, correct_count, total_count, practiced_on } o null
  p_session jsonb default null,
  -- [ { word_id, turn_id, correct, score } ]
  p_answers jsonb default '[]',
  -- [ { word_id, source } ]
  p_words jsonb default '[]',
  p_achievements text[] default '{}'
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_version integer;
  v_session_id uuid;
begin
  -- Bloquea el progreso del estudiante hasta terminar: las peticiones
  -- simultáneas del mismo estudiante esperan su turno.
  select version into v_current_version
  from public.progress
  where user_id = p_user_id
  for update;

  if v_current_version is distinct from p_expected_version then
    return 'conflict';
  end if;

  if p_session is not null then
    begin
      insert into public.activity_sessions (user_id, event_id, activity, score, xp_awarded, correct_count, total_count, practiced_on)
      values (
        p_user_id,
        p_session ->> 'event_id',
        p_session ->> 'activity',
        (p_session ->> 'score')::numeric,
        (p_session ->> 'xp_awarded')::integer,
        (p_session ->> 'correct_count')::smallint,
        (p_session ->> 'total_count')::smallint,
        (p_session ->> 'practiced_on')::date
      )
      returning id into v_session_id;
    exception when unique_violation then
      -- La partida ya estaba guardada: no se cambia nada más.
      return 'duplicate';
    end;

    insert into public.activity_answers (session_id, position, user_id, word_id, turn_id, correct, score)
    select v_session_id, (answer.ordinality - 1)::smallint, p_user_id,
           answer.value ->> 'word_id', answer.value ->> 'turn_id',
           (answer.value ->> 'correct')::boolean, (answer.value ->> 'score')::smallint
    from jsonb_array_elements(p_answers) with ordinality as answer(value, ordinality);
  end if;

  update public.progress set
    total_xp = (p_progress ->> 'total_xp')::integer,
    current_streak = (p_progress ->> 'current_streak')::integer,
    best_streak = (p_progress ->> 'best_streak')::integer,
    last_practice_date = (p_progress ->> 'last_practice_date')::date,
    version = version + 1,
    updated_at = now()
  where user_id = p_user_id;

  insert into public.studied_words (user_id, word_id, source)
  select p_user_id, word.value ->> 'word_id', word.value ->> 'source'
  from jsonb_array_elements(p_words) as word(value)
  on conflict (user_id, word_id) do nothing;

  insert into public.user_achievements (user_id, achievement_id)
  select p_user_id, achievement_id
  from unnest(p_achievements) as achievement_id
  on conflict (user_id, achievement_id) do nothing;

  return 'applied';
end;
$$;

-- Solo el backend (service_role) puede ejecutarla. Por defecto PostgreSQL y
-- Supabase permiten ejecutar funciones a todos, así que se retira ese permiso.
revoke all on function public.apply_practice(uuid, integer, jsonb, jsonb, jsonb, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.apply_practice(uuid, integer, jsonb, jsonb, jsonb, jsonb, text[]) to service_role;
