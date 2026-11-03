import type { Level } from './catalog.js'

export type LevelStanding = {
  level: number
  name: string
  // XP necesaria para el siguiente nivel; null en el nivel máximo.
  nextLevelXp: number | null
  // Avance dentro del nivel actual, de 0 a 100.
  progressPercentage: number
}

export function levelFor(totalXp: number, levels: readonly Level[]): LevelStanding {
  const ordered = [...levels].sort((first, second) => first.minimumXp - second.minimumXp)
  const currentIndex = ordered.reduce((found, level, index) => (totalXp >= level.minimumXp ? index : found), 0)
  const current = ordered[currentIndex]
  const next = ordered[currentIndex + 1]
  return {
    level: current.level,
    name: current.name,
    nextLevelXp: next?.minimumXp ?? null,
    progressPercentage: next
      ? Math.min(100, Math.round(((totalXp - current.minimumXp) / (next.minimumXp - current.minimumXp)) * 100))
      : 100,
  }
}

// Fechas del calendario del estudiante (AAAA-MM-DD), sin horas ni zona horaria.
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

// La racha guardada solo sigue viva si se practicó hoy o ayer.
export function effectiveStreak(progress: { currentStreak: number; lastPracticeDate: string | null }, today: string) {
  if (!progress.lastPracticeDate) return 0
  return daysBetween(progress.lastPracticeDate, today) <= 1 ? progress.currentStreak : 0
}
