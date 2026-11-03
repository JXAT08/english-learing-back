import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { SpeechEngine } from '../../domain/preferences.js'
import type { StudentAccountRepository } from '../../ports/studentAccountRepository.js'

type Query<T> = { data: T | null; error: PostgrestError | null }

// Un fallo de Supabase es un error de infraestructura: se lanza y la API
// responde 500 sin detalles. Las tres variantes dejan claro qué se espera.
function optional<T>(result: Query<T>, action: string): T | null {
  if (result.error) throw new Error(`${action}: ${result.error.message}`)
  return result.data
}

function required<T>(result: Query<T>, action: string): NonNullable<T> {
  const data = optional(result, action)
  if (data === null || data === undefined) throw new Error(`${action}: no se encontró la fila`)
  return data
}

function rows<T>(result: Query<T[]>, action: string): T[] {
  return optional(result, action) ?? []
}

function check(result: { error: PostgrestError | null }, action: string) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`)
}

type ProfileRow = { display_name: string; avatar_id: string; created_at: string }

const toProfile = (row: ProfileRow) => ({ displayName: row.display_name, avatarId: row.avatar_id, createdAt: row.created_at })

// Toda consulta filtra por user_id: el cliente usa la clave secreta y salta la
// seguridad por fila, así que el filtro es la garantía de no mezclar estudiantes.
export function createSupabaseStudentAccountRepository(client: SupabaseClient): StudentAccountRepository {
  const repository: StudentAccountRepository = {
    async findAccount(userId) {
      const [profile, progress, preferences, words, achievements] = await Promise.all([
        client.from('profiles').select('display_name, avatar_id, created_at').eq('user_id', userId).maybeSingle(),
        client.from('progress').select('total_xp, current_streak, best_streak, last_practice_date').eq('user_id', userId).maybeSingle(),
        client.from('user_preferences').select('sound_enabled, speech_engine').eq('user_id', userId).maybeSingle(),
        client.from('studied_words').select('word_id').eq('user_id', userId).order('studied_at'),
        client.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId).order('unlocked_at'),
      ])
      const profileRow = optional(profile, 'Leer perfil')
      if (!profileRow) return null
      const progressRow = optional(progress, 'Leer progreso')
      const preferencesRow = optional(preferences, 'Leer preferencias')
      return {
        profile: toProfile(profileRow),
        progress: {
          totalXp: progressRow?.total_xp ?? 0,
          currentStreak: progressRow?.current_streak ?? 0,
          bestStreak: progressRow?.best_streak ?? 0,
          lastPracticeDate: progressRow?.last_practice_date ?? null,
        },
        preferences: {
          soundEnabled: preferencesRow?.sound_enabled ?? true,
          speechEngine: (preferencesRow?.speech_engine ?? 'auto') as SpeechEngine,
        },
        studiedWordIds: rows(words, 'Leer palabras estudiadas').map((row) => row.word_id),
        achievements: rows(achievements, 'Leer insignias').map((row) => ({ id: row.achievement_id, unlockedAt: row.unlocked_at })),
      }
    },

    async createAccount(userId, profile) {
      // ignoreDuplicates: si dos peticiones llegan a la vez, la segunda no pisa a la primera.
      const options = { onConflict: 'user_id', ignoreDuplicates: true }
      check(await client.from('profiles').upsert({ user_id: userId, display_name: profile.displayName, avatar_id: profile.avatarId }, options), 'Crear perfil')
      check(await client.from('progress').upsert({ user_id: userId }, options), 'Crear progreso')
      check(await client.from('user_preferences').upsert({ user_id: userId }, options), 'Crear preferencias')
      const account = await repository.findAccount(userId)
      if (!account) throw new Error('La cuenta no quedó creada.')
      return account
    },

    async updateProfile(userId, changes) {
      const row = required(
        await client.from('profiles')
          .update({ display_name: changes.displayName, avatar_id: changes.avatarId, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .select('display_name, avatar_id, created_at')
          .single<ProfileRow>(),
        'Actualizar perfil',
      )
      return toProfile(row)
    },

    async updatePreferences(userId, preferences) {
      const row = required(
        await client.from('user_preferences')
          .upsert({ user_id: userId, sound_enabled: preferences.soundEnabled, speech_engine: preferences.speechEngine, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          .select('sound_enabled, speech_engine')
          .single<{ sound_enabled: boolean; speech_engine: string }>(),
        'Guardar preferencias',
      )
      return { soundEnabled: row.sound_enabled, speechEngine: row.speech_engine as SpeechEngine }
    },
  }
  return repository
}
