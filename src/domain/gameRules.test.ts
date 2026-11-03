import { describe, expect, it } from 'vitest'
import { advanceStreak, achievementsToUnlock, rewardFor, scoreAnswers } from './gameRules.js'

const fresh = { totalXp: 0, currentStreak: 0, bestStreak: 0, lastPracticeDate: null }

describe('racha al practicar', () => {
  it('empieza en 1, se mantiene el mismo día, sube al día siguiente y se reinicia tras una pausa', () => {
    const first = advanceStreak(fresh, '2026-08-27')
    const sameDay = advanceStreak(first, '2026-08-27')
    const nextDay = advanceStreak(sameDay, '2026-08-28')
    const afterPause = advanceStreak(nextDay, '2026-08-30')

    expect([first, sameDay, nextDay, afterPause].map((progress) => progress.currentStreak)).toEqual([1, 1, 2, 1])
    expect(afterPause).toMatchObject({ bestStreak: 2, lastPracticeDate: '2026-08-30' })
  })

  it('no retrocede la fecha con una práctica de un día anterior', () => {
    const progress = { totalXp: 0, currentStreak: 2, bestStreak: 2, lastPracticeDate: '2026-11-03' }

    expect(advanceStreak(progress, '2026-11-02')).toEqual(progress)
  })
})

describe('puntuación de una partida', () => {
  it('usa los aciertos cuando las respuestas no traen puntuación', () => {
    expect(scoreAnswers([{ correct: true }, { correct: true }, { correct: false }, { correct: true }])).toEqual({ score: 0.75, correctCount: 3, totalCount: 4 })
  })

  it('usa la puntuación de 0 a 100 cuando la hay (pronunciación, definiciones parciales)', () => {
    expect(scoreAnswers([{ correct: true, score: 100 }, { correct: false, score: 50 }, { correct: false, score: 0 }])).toEqual({ score: 0.5, correctCount: 1, totalCount: 3 })
  })
})

describe('XP de una partida', () => {
  const rule = { activity: 'definition', baseXp: 25, dailyRewardLimit: 3 }

  it.each([
    [1, 25],
    [0.5, 13],
    [1 / 3, 8],
    [0, 0],
  ])('con puntuación %d da %i XP', (score, xp) => {
    expect(rewardFor(rule, score, 0)).toEqual({ xpAwarded: xp, dailyLimitReached: false })
  })

  it('no da XP después del tope diario de la actividad', () => {
    expect(rewardFor(rule, 1, 3)).toEqual({ xpAwarded: 0, dailyLimitReached: true })
  })

  it('una actividad sin tope nunca lo alcanza', () => {
    expect(rewardFor({ activity: 'word-study', baseXp: 10, dailyRewardLimit: null }, 1, 99)).toEqual({ xpAwarded: 10, dailyLimitReached: false })
  })
})

describe('insignias', () => {
  const all = ['first-step', 'five-words', 'first-game', 'three-day-streak', 'xp-500']
  const base = { available: all, unlocked: [] as string[], studiedWordCount: 0, totalXp: 0, currentStreak: 0, xpAwarded: 0, completedGame: false }

  it('desbloquea cada insignia solo cuando se cumple su condición', () => {
    expect(achievementsToUnlock(base)).toEqual([])
    expect(achievementsToUnlock({ ...base, xpAwarded: 10, totalXp: 10 })).toEqual(['first-step'])
    expect(achievementsToUnlock({ ...base, studiedWordCount: 5 })).toEqual(['five-words'])
    expect(achievementsToUnlock({ ...base, completedGame: true })).toEqual(['first-game'])
    expect(achievementsToUnlock({ ...base, currentStreak: 3 })).toEqual(['three-day-streak'])
    expect(achievementsToUnlock({ ...base, totalXp: 500 })).toEqual(['xp-500'])
  })

  it('no repite insignias ya desbloqueadas ni inventa las que no existen en la base', () => {
    expect(achievementsToUnlock({ ...base, unlocked: ['first-step'], xpAwarded: 10, totalXp: 10 })).toEqual([])
    expect(achievementsToUnlock({ ...base, available: ['first-step'], completedGame: true })).toEqual([])
  })
})
