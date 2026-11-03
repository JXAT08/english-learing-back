-- Seguridad por fila. El navegador tiene la clave pública y el token del
-- estudiante, así que podría llamar a Supabase directamente. Por eso:
--   · El contenido se puede leer sin sesión y no se puede modificar.
--   · Cada estudiante solo puede LEER sus propios datos.
--   · Solo el backend (rol service_role, clave secreta) escribe progreso,
--     XP, insignias y partidas, después de aplicar las reglas del juego.

do $$
declare
  content_table text;
  student_table text;
begin
  foreach content_table in array array[
    'categories', 'words', 'conversation_scenarios', 'conversation_turns',
    'levels', 'achievement_definitions', 'avatars', 'daily_tips', 'activity_rules'
  ] loop
    execute format('alter table public.%I enable row level security', content_table);
    execute format('revoke all on public.%I from anon, authenticated', content_table);
    execute format('grant select on public.%I to anon, authenticated', content_table);
    execute format('create policy "contenido visible para todos" on public.%I for select to anon, authenticated using (true)', content_table);
  end loop;

  foreach student_table in array array[
    'profiles', 'progress', 'studied_words', 'user_achievements',
    'activity_sessions', 'activity_answers', 'user_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', student_table);
    execute format('revoke all on public.%I from anon, authenticated', student_table);
    execute format('grant select on public.%I to authenticated', student_table);
    -- (select auth.uid()) se evalúa una vez por consulta, no por fila.
    execute format('create policy "cada estudiante lee lo suyo" on public.%I for select to authenticated using (user_id = (select auth.uid()))', student_table);
  end loop;
end
$$;

-- Las tablas que se creen después no quedan abiertas por accidente.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
