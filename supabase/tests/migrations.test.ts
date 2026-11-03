import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { actAsAnonymous, actAsBackend, actAsStudent, createTestDatabase, createUser, migrationFiles } from './testDatabase.js'

const ANA = '11111111-1111-4111-8111-111111111111'
const LUIS = '22222222-2222-4222-8222-222222222222'

async function count(db: PGlite, table: string) {
  const result = await db.query<{ total: number }>(`select count(*)::int as total from ${table}`)
  return result.rows[0].total
}

describe('migraciones de la base de datos', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createTestDatabase()
    await createUser(db, ANA)
    await createUser(db, LUIS)
    await actAsBackend(db)
    for (const user of [ANA, LUIS]) {
      await db.query('insert into profiles (user_id, display_name) values ($1, $2)', [user, 'Estudiante'])
      await db.query('insert into progress (user_id, total_xp) values ($1, $2)', [user, user === ANA ? 120 : 40])
    }
  }, 60_000)

  it('existen y se aplican en orden', () => {
    expect(migrationFiles().length).toBeGreaterThanOrEqual(3)
  })

  describe('contenido cargado desde el frontend', () => {
    it('trae las 3 categorías y las 60 palabras, todas con al menos un par para el juego', async () => {
      await actAsBackend(db)
      expect(await count(db, 'categories')).toBe(3)
      expect(await count(db, 'words')).toBe(60)
      const withoutPairs = await db.query(`select id from words where cardinality(synonyms) + cardinality(antonyms) = 0`)
      expect(withoutPairs.rows).toEqual([])
    })

    it('conserva los datos exactos de cada palabra', async () => {
      await actAsBackend(db)
      const browser = await db.query(`select category_id, term, translation, keywords, synonyms, pronunciation_hint, difficulty from words where id = 'web-browser'`)
      expect(browser.rows[0]).toEqual({
        category_id: 'web-development',
        term: 'Browser',
        translation: 'Navegador',
        keywords: ['program', 'website', 'display'],
        synonyms: ['web browser'],
        pronunciation_hint: 'brau-ser',
        difficulty: 'beginner',
      })
    })

    it('trae escenarios de conversación, niveles, insignias, avatares, consejos y reglas del juego', async () => {
      await actAsBackend(db)
      expect(await count(db, 'conversation_scenarios')).toBe(2)
      expect(await count(db, 'conversation_turns')).toBe(6)
      const levels = await db.query<{ minimum_xp: number }>('select minimum_xp from levels order by level')
      expect(levels.rows.map((row) => row.minimum_xp)).toEqual([0, 100, 250, 450, 700])
      expect(await count(db, 'achievement_definitions')).toBe(5)
      expect(await count(db, 'avatars')).toBe(6)
      expect(await count(db, 'daily_tips')).toBeGreaterThan(0)
      const rules = await db.query('select activity, base_xp, daily_reward_limit from activity_rules order by activity')
      expect(rules.rows).toEqual([
        { activity: 'conversation', base_xp: 30, daily_reward_limit: 3 },
        { activity: 'definition', base_xp: 25, daily_reward_limit: 3 },
        { activity: 'pronunciation', base_xp: 20, daily_reward_limit: 3 },
        { activity: 'synonym-antonym', base_xp: 25, daily_reward_limit: 3 },
        { activity: 'word-study', base_xp: 10, daily_reward_limit: null },
      ])
    })
  })

  describe('integridad de los datos', () => {
    it('rechaza una puntuación fuera de 0 a 1', async () => {
      await actAsBackend(db)
      await expect(db.query(
        `insert into activity_sessions (user_id, event_id, activity, score, xp_awarded, correct_count, total_count, practiced_on)
         values ($1, 'evento-malo', 'definition', 1.5, 0, 0, 3, '2026-11-03')`, [ANA],
      )).rejects.toThrow()
    })

    it('no guarda dos veces la misma partida de un estudiante', async () => {
      await actAsBackend(db)
      const insert = () => db.query(
        `insert into activity_sessions (user_id, event_id, activity, score, xp_awarded, correct_count, total_count, practiced_on)
         values ($1, 'partida-1', 'definition', 1, 25, 3, 3, '2026-11-03')`, [ANA],
      )
      await insert()
      await expect(insert()).rejects.toThrow()
    })

    it('rechaza una palabra estudiada que no existe en el catálogo', async () => {
      await actAsBackend(db)
      await expect(db.query(`insert into studied_words (user_id, word_id, source) values ($1, 'palabra-inventada', 'resources')`, [ANA])).rejects.toThrow()
    })
  })

  describe('seguridad por fila', () => {
    it('un estudiante lee su progreso y no ve el de otro', async () => {
      await actAsStudent(db, ANA)
      const rows = await db.query<{ user_id: string; total_xp: number }>('select user_id, total_xp from progress')
      expect(rows.rows).toEqual([{ user_id: ANA, total_xp: 120 }])
    })

    it.each([
      ['subirse la XP', `update progress set total_xp = 99999`],
      ['crear partidas', `insert into activity_sessions (user_id, event_id, activity, score, xp_awarded, correct_count, total_count, practiced_on) values ('${ANA}', 'trampa', 'definition', 1, 25, 3, 3, '2026-11-03')`],
      ['marcar palabras', `insert into studied_words (user_id, word_id, source) values ('${ANA}', 'web-link', 'resources')`],
      ['darse insignias', `insert into user_achievements (user_id, achievement_id) values ('${ANA}', 'xp-500')`],
      ['cambiar el catálogo', `update words set term = 'X'`],
    ])('un estudiante no puede %s saltándose el backend', async (_case, statement) => {
      await actAsStudent(db, ANA)
      await expect(db.query(statement)).rejects.toThrow(/permission denied/i)
      await actAsBackend(db)
      expect((await db.query<{ total_xp: number }>('select total_xp from progress where user_id = $1', [ANA])).rows[0].total_xp).toBe(120)
    })

    it('un visitante sin sesión lee el catálogo pero no datos de estudiantes', async () => {
      await actAsAnonymous(db)
      expect(await count(db, 'words')).toBe(60)
      await expect(db.query('select * from progress')).rejects.toThrow(/permission denied/i)
    })

    it('el backend puede guardar el progreso de cualquier estudiante', async () => {
      await actAsBackend(db)
      await db.query('update progress set total_xp = total_xp + 25 where user_id = $1', [LUIS])
      expect((await db.query<{ total_xp: number }>('select total_xp from progress where user_id = $1', [LUIS])).rows[0].total_xp).toBe(65)
    })
  })

  it('borrar la cuenta borra todos sus datos', async () => {
    await actAsBackend(db)
    await db.query(`insert into studied_words (user_id, word_id, source) values ($1, 'web-link', 'practice')`, [LUIS])
    await db.query('reset role')
    await db.query('delete from auth.users where id = $1', [LUIS])
    await actAsBackend(db)
    for (const table of ['profiles', 'progress', 'studied_words', 'activity_sessions', 'user_achievements', 'user_preferences']) {
      expect((await db.query(`select 1 from ${table} where user_id = $1`, [LUIS])).rows).toEqual([])
    }
  })
})
