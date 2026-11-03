import { describe, expect, it } from 'vitest'
import { daysBetween, effectiveStreak, levelFor } from './progress.js'

const levels = [
  { level: 1, name: 'Principiante', minimumXp: 0 },
  { level: 2, name: 'Aprendiz', minimumXp: 100 },
  { level: 3, name: 'Explorador', minimumXp: 250 },
]

describe('nivel según la XP', () => {
  it.each([
    [0, 1, 'Principiante', 100, 0],
    [99, 1, 'Principiante', 100, 99],
    [100, 2, 'Aprendiz', 250, 0],
    [175, 2, 'Aprendiz', 250, 50],
  ])('%i XP es nivel %i (%s)', (xp, level, name, nextLevelXp, percentage) => {
    expect(levelFor(xp, levels)).toEqual({ level, name, nextLevelXp, progressPercentage: percentage })
  })

  it('en el nivel máximo no hay meta siguiente', () => {
    expect(levelFor(900, levels)).toEqual({ level: 3, name: 'Explorador', nextLevelXp: null, progressPercentage: 100 })
  })

  it('no depende del orden en que lleguen los niveles', () => {
    expect(levelFor(120, [...levels].reverse()).level).toBe(2)
  })
})

describe('racha visible', () => {
  it('cuenta los días entre dos fechas del calendario', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it.each([
    ['hoy', '2026-11-03', 4],
    ['ayer', '2026-11-02', 4],
    ['hace dos días', '2026-11-01', 0],
  ])('se mantiene si la última práctica fue %s', (_case, lastPracticeDate, expected) => {
    expect(effectiveStreak({ currentStreak: 4, lastPracticeDate }, '2026-11-03')).toBe(expected)
  })

  it('es 0 si nunca practicó', () => {
    expect(effectiveStreak({ currentStreak: 3, lastPracticeDate: null }, '2026-11-03')).toBe(0)
  })
})
