import { describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import { createInMemoryPracticeRepository } from '../testing/inMemoryPracticeRepository.js'
import { createInMemoryAccountRepository, createInMemoryCatalogRepository } from '../testing/inMemoryRepositories.js'
import { createRecordActivity, createStudyWord } from './practice.js'

const ana: AuthenticatedUser = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', name: 'Ana' }
const TODAY = '2026-11-03'

function setup() {
  const accounts = createInMemoryAccountRepository()
  const catalog = createInMemoryCatalogRepository()
  const practice = createInMemoryPracticeRepository(accounts)
  return {
    accounts,
    practice,
    recordActivity: createRecordActivity({ accounts, catalog, practice }),
    studyWord: createStudyWord({ accounts, catalog, practice }),
    stored: () => accounts.accounts.get(ana.id)!,
  }
}

const definitionGame = (eventId: string, results: boolean[]) => ({
  eventId,
  activity: 'definition',
  answers: results.map((correct, index) => ({ wordId: ['web-browser', 'web-component', 'web-deploy'][index], correct })),
})

describe('registrar una partida', () => {
  it('calcula la XP en el servidor, empieza la racha, marca las palabras acertadas y da insignias', async () => {
    const { recordActivity, stored } = setup()

    const result = await recordActivity(ana, definitionGame('partida-1', [true, true, true]), TODAY)

    expect(result).toEqual({ ok: true, value: { xpAwarded: 25, dailyLimitReached: false, newAchievements: ['first-step', 'first-game'], duplicate: false } })
    expect(stored().progress).toEqual({ totalXp: 25, currentStreak: 1, bestStreak: 1, lastPracticeDate: TODAY })
    expect(stored().studiedWordIds).toEqual(['web-browser', 'web-component', 'web-deploy'])
  })

  it('da XP proporcional a los aciertos y solo marca las palabras acertadas', async () => {
    const { recordActivity, stored } = setup()

    const result = await recordActivity(ana, definitionGame('partida-1', [true, false, false]), TODAY)

    expect(result.ok && result.value.xpAwarded).toBe(8)
    expect(stored().studiedWordIds).toEqual(['web-browser'])
  })

  it('usa la puntuación de cada respuesta cuando la trae (pronunciación, coincidencias parciales)', async () => {
    const { recordActivity } = setup()

    const result = await recordActivity(ana, {
      eventId: 'partida-1',
      activity: 'definition',
      answers: [{ wordId: 'web-browser', correct: true, score: 100 }, { wordId: 'web-component', correct: false, score: 50 }],
    }, TODAY)

    expect(result.ok && result.value.xpAwarded).toBe(19)
  })

  it('después de 3 partidas del día sigue guardando, pero sin XP', async () => {
    const { recordActivity, stored } = setup()
    for (const eventId of ['p1', 'p2', 'p3']) await recordActivity(ana, definitionGame(eventId, [true, true, true]), TODAY)

    const fourth = await recordActivity(ana, definitionGame('p4', [true, true, true]), TODAY)
    const nextDay = await recordActivity(ana, definitionGame('p5', [true, true, true]), '2026-11-04')

    expect(fourth.ok && fourth.value).toMatchObject({ xpAwarded: 0, dailyLimitReached: true })
    expect(nextDay.ok && nextDay.value).toMatchObject({ xpAwarded: 25, dailyLimitReached: false })
    expect(stored().progress).toMatchObject({ totalXp: 100, currentStreak: 2 })
  })

  it('una partida repetida (mismo eventId) no vuelve a sumar XP', async () => {
    const { recordActivity, stored } = setup()
    await recordActivity(ana, definitionGame('partida-1', [true, true, true]), TODAY)

    const repeated = await recordActivity(ana, definitionGame('partida-1', [true, true, true]), TODAY)

    expect(repeated).toEqual({ ok: true, value: { xpAwarded: 25, dailyLimitReached: false, newAchievements: [], duplicate: true } })
    expect(stored().progress.totalXp).toBe(25)
  })

  it('si el progreso cambió mientras calculaba, vuelve a calcular y guarda una sola vez', async () => {
    const { recordActivity, practice, stored } = setup()
    practice.conflictsToSimulate = 2

    const result = await recordActivity(ana, definitionGame('partida-1', [true, true, true]), TODAY)

    expect(result.ok).toBe(true)
    expect(practice.writes).toHaveLength(1)
    expect(stored().progress.totalXp).toBe(25)
  })

  it('falla si el conflicto no se resuelve tras varios intentos', async () => {
    const { recordActivity, practice } = setup()
    practice.conflictsToSimulate = 10

    await expect(recordActivity(ana, definitionGame('partida-1', [true]), TODAY)).rejects.toThrow(/conflicto/i)
  })

  it('acepta respuestas de conversación con turnos existentes', async () => {
    const { recordActivity } = setup()

    const result = await recordActivity(ana, { eventId: 'charla', activity: 'conversation', answers: [{ turnId: 'standup-task', correct: true }] }, TODAY)

    expect(result.ok && result.value.xpAwarded).toBe(30)
  })

  it.each([
    ['una actividad desconocida', { eventId: 'x', activity: 'ajedrez', answers: [{ correct: true }] }, /actividad/i],
    ['estudiar palabras como si fuera un juego', { eventId: 'x', activity: 'word-study', answers: [{ correct: true }] }, /actividad/i],
    ['una palabra que no existe', { eventId: 'x', activity: 'definition', answers: [{ wordId: 'inventada', correct: true }] }, /palabra/i],
    ['un turno que no existe', { eventId: 'x', activity: 'conversation', answers: [{ turnId: 'inventado', correct: true }] }, /turno/i],
  ])('rechaza %s sin guardar nada', async (_case, input, message) => {
    const { recordActivity, practice } = setup()

    const result = await recordActivity(ana, input, TODAY)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toEqual({ code: 'validation_error', message: expect.stringMatching(message) })
    expect(practice.writes).toEqual([])
  })
})

describe('marcar una palabra como estudiada en Recursos', () => {
  it('da 10 XP la primera vez y cuenta como práctica del día', async () => {
    const { studyWord, stored } = setup()

    const result = await studyWord(ana, 'web-link', TODAY)

    expect(result).toEqual({ ok: true, value: { xpAwarded: 10, dailyLimitReached: false, newAchievements: ['first-step'], duplicate: false } })
    expect(stored().studiedWordIds).toEqual(['web-link'])
    expect(stored().progress).toMatchObject({ totalXp: 10, currentStreak: 1 })
  })

  it('una palabra ya estudiada no vuelve a dar XP', async () => {
    const { studyWord, stored } = setup()
    await studyWord(ana, 'web-link', TODAY)

    const again = await studyWord(ana, 'web-link', TODAY)

    expect(again.ok && again.value).toMatchObject({ xpAwarded: 0, duplicate: true })
    expect(stored().progress.totalXp).toBe(10)
  })

  it('la quinta palabra desbloquea la insignia de palabras', async () => {
    const { studyWord } = setup()
    for (const word of ['web-browser', 'web-component', 'web-deploy', 'web-link']) await studyWord(ana, word, TODAY)

    const fifth = await studyWord(ana, 'web-route', TODAY)

    expect(fifth.ok && fifth.value.newAchievements).toEqual(['five-words'])
  })

  it('rechaza una palabra que no existe', async () => {
    const { studyWord } = setup()

    const result = await studyWord(ana, 'inventada', TODAY)

    expect(!result.ok && result.error.code).toBe('not_found')
  })
})
