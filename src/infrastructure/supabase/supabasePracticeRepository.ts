import type { SupabaseClient } from '@supabase/supabase-js'
import type { PracticeRepository, PracticeWriteResult } from '../../ports/practiceRepository.js'

const RESULTS: readonly PracticeWriteResult[] = ['applied', 'duplicate', 'conflict']

function fail(action: string, message: string): never {
  throw new Error(`${action}: ${message}`)
}

// Lecturas por separado y escritura en un solo paso con apply_practice
// (función de PostgreSQL ejecutable solo con la clave secreta).
export function createSupabasePracticeRepository(client: SupabaseClient): PracticeRepository {
  return {
    async loadSnapshot(userId, activity, practicedOn) {
      const sessionsToday = activity === null
        ? Promise.resolve({ count: 0, error: null })
        : client.from('activity_sessions').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('activity', activity).eq('practiced_on', practicedOn)
      const [progress, words, achievements, sessions] = await Promise.all([
        client.from('progress').select('total_xp, current_streak, best_streak, last_practice_date, version').eq('user_id', userId)
          .single<{ total_xp: number; current_streak: number; best_streak: number; last_practice_date: string | null; version: number }>(),
        client.from('studied_words').select('word_id').eq('user_id', userId),
        client.from('user_achievements').select('achievement_id').eq('user_id', userId),
        sessionsToday,
      ])
      if (progress.error) fail('Leer progreso', progress.error.message)
      if (words.error) fail('Leer palabras estudiadas', words.error.message)
      if (achievements.error) fail('Leer insignias', achievements.error.message)
      if (sessions.error) fail('Contar partidas del día', sessions.error.message)
      return {
        progress: {
          totalXp: progress.data.total_xp,
          currentStreak: progress.data.current_streak,
          bestStreak: progress.data.best_streak,
          lastPracticeDate: progress.data.last_practice_date,
        },
        version: progress.data.version,
        studiedWordIds: (words.data ?? []).map((row) => row.word_id as string),
        achievementIds: (achievements.data ?? []).map((row) => row.achievement_id as string),
        sessionsToday: sessions.count ?? 0,
      }
    },

    async findSessionXp(userId, eventId) {
      const { data, error } = await client.from('activity_sessions').select('xp_awarded').eq('user_id', userId).eq('event_id', eventId)
        .maybeSingle<{ xp_awarded: number }>()
      if (error) fail('Buscar partida', error.message)
      return data?.xp_awarded ?? null
    },

    async apply(userId, write) {
      const { data, error } = await client.rpc('apply_practice', {
        p_user_id: userId,
        p_expected_version: write.expectedVersion,
        p_progress: {
          total_xp: write.progress.totalXp,
          current_streak: write.progress.currentStreak,
          best_streak: write.progress.bestStreak,
          last_practice_date: write.progress.lastPracticeDate,
        },
        p_session: write.session && {
          event_id: write.session.eventId,
          activity: write.session.activity,
          score: Number(write.session.score.toFixed(3)),
          xp_awarded: write.session.xpAwarded,
          correct_count: write.session.correctCount,
          total_count: write.session.totalCount,
          practiced_on: write.session.practicedOn,
        },
        p_answers: write.answers.map((answer) => ({
          word_id: answer.wordId ?? null,
          turn_id: answer.turnId ?? null,
          correct: answer.correct,
          score: answer.score ?? null,
        })),
        p_words: write.words.map((word) => ({ word_id: word.wordId, source: word.source })),
        p_achievements: write.achievements,
      })
      if (error) fail('Guardar práctica', error.message)
      if (!RESULTS.includes(data)) fail('Guardar práctica', `respuesta inesperada ${String(data)}`)
      return data as PracticeWriteResult
    },
  }
}
