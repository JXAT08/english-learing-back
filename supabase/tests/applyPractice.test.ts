import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { actAsAnonymous, actAsBackend, actAsStudent, createTestDatabase, createUser } from './testDatabase.js'

const ANA = '11111111-1111-4111-8111-111111111111'

const progress = { total_xp: 25, current_streak: 1, best_streak: 1, last_practice_date: '2026-11-03' }
const session = { event_id: 'partida-1', activity: 'definition', score: 1, xp_awarded: 25, correct_count: 3, total_count: 3, practiced_on: '2026-11-03' }
const answers = [
  { word_id: 'web-browser', correct: true, score: 100 },
  { word_id: 'web-component', correct: true, score: 100 },
  { word_id: 'web-deploy', correct: true, score: 100 },
]
const words = [{ word_id: 'web-browser', source: 'practice' }]

async function applyPractice(db: PGlite, args: { version?: number; session?: unknown; answers?: unknown; words?: unknown; achievements?: string[] } = {}) {
  const result = await db.query<{ result: string }>(
    'select public.apply_practice($1, $2, $3, $4, $5, $6, $7) as result',
    [ANA, args.version ?? 0, JSON.stringify(progress), args.session === undefined ? JSON.stringify(session) : args.session, JSON.stringify(args.answers ?? answers), JSON.stringify(args.words ?? words), args.achievements ?? ['first-step', 'first-game']],
  )
  return result.rows[0].result
}

async function snapshot(db: PGlite) {
  await actAsBackend(db)
  const read = async (sql: string) => (await db.query(sql, [ANA])).rows
  return {
    progress: (await read('select total_xp, current_streak, version from progress where user_id = $1'))[0],
    sessions: await read('select event_id, xp_awarded from activity_sessions where user_id = $1'),
    answers: await read('select position, word_id, correct, score from activity_answers where user_id = $1 order by position'),
    words: await read('select word_id, source from studied_words where user_id = $1'),
    achievements: await read('select achievement_id from user_achievements where user_id = $1 order by achievement_id'),
  }
}

describe('escritura atómica de una práctica (apply_practice)', () => {
  let db: PGlite

  beforeEach(async () => {
    db = await createTestDatabase()
    await createUser(db, ANA)
    await actAsBackend(db)
    await db.query('insert into profiles (user_id, display_name) values ($1, $2)', [ANA, 'Ana'])
    await db.query('insert into progress (user_id) values ($1)', [ANA])
  }, 60_000)

  it('guarda progreso, partida, respuestas, palabras e insignias de una vez', async () => {
    await actAsBackend(db)

    expect(await applyPractice(db)).toBe('applied')

    expect(await snapshot(db)).toEqual({
      progress: { total_xp: 25, current_streak: 1, version: 1 },
      sessions: [{ event_id: 'partida-1', xp_awarded: 25 }],
      answers: [
        { position: 0, word_id: 'web-browser', correct: true, score: 100 },
        { position: 1, word_id: 'web-component', correct: true, score: 100 },
        { position: 2, word_id: 'web-deploy', correct: true, score: 100 },
      ],
      words: [{ word_id: 'web-browser', source: 'practice' }],
      achievements: [{ achievement_id: 'first-game' }, { achievement_id: 'first-step' }],
    })
  })

  it('una partida repetida no cambia nada', async () => {
    await actAsBackend(db)
    await applyPractice(db)

    expect(await applyPractice(db, { version: 1 })).toBe('duplicate')

    const after = await snapshot(db)
    expect(after.progress).toEqual({ total_xp: 25, current_streak: 1, version: 1 })
    expect(after.sessions).toHaveLength(1)
  })

  it('si el progreso cambió mientras se calculaba, no escribe nada y avisa', async () => {
    await actAsBackend(db)

    expect(await applyPractice(db, { version: 7 })).toBe('conflict')

    const after = await snapshot(db)
    expect(after.progress).toEqual({ total_xp: 0, current_streak: 0, version: 0 })
    expect(after.sessions).toEqual([])
  })

  it('marcar una palabra en Recursos funciona sin partida', async () => {
    await actAsBackend(db)

    expect(await applyPractice(db, { session: null, answers: [], words: [{ word_id: 'web-link', source: 'resources' }], achievements: [] })).toBe('applied')

    const after = await snapshot(db)
    expect(after.words).toEqual([{ word_id: 'web-link', source: 'resources' }])
    expect(after.sessions).toEqual([])
  })

  it('si algo falla a mitad, deshace todo (respuesta con una palabra inexistente)', async () => {
    await actAsBackend(db)

    await expect(applyPractice(db, { answers: [{ word_id: 'palabra-inventada', correct: true, score: 100 }] })).rejects.toThrow()

    const after = await snapshot(db)
    expect(after.progress).toEqual({ total_xp: 0, current_streak: 0, version: 0 })
    expect(after.sessions).toEqual([])
  })

  it.each([
    ['un estudiante', (database: PGlite) => actAsStudent(database, ANA)],
    ['un visitante sin sesión', (database: PGlite) => actAsAnonymous(database)],
  ])('%s no puede ejecutarla saltándose el backend', async (_case, actAs) => {
    await actAs(db)

    await expect(applyPractice(db)).rejects.toThrow(/permission denied/i)
  })
})
