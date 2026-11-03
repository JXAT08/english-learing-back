import type { ActivityRule } from './catalog.js'
import type { StudentProgress } from './progress.js'

// ─── Racha ──────────────────────────────────────────────────────────────────

// Practicar el día siguiente suma 1; el mismo día no cambia nada; tras una
// pausa vuelve a 1. Una práctica con fecha anterior a la última no retrocede.
export function advanceStreak(progress: StudentProgress, practicedOn: string): StudentProgress {
  const last = progress.lastPracticeDate
  if (last && practicedOn <= last) return progress
  const nextDay = last !== null && Date.parse(`${practicedOn}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`) === 86_400_000
  const currentStreak = nextDay ? progress.currentStreak + 1 : 1
  return {
    ...progress,
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    lastPracticeDate: practicedOn,
  }
}

// ─── Puntuación y XP ────────────────────────────────────────────────────────

export type AnswerResult = { correct: boolean; score?: number }

// Puntuación de 0 a 1. Cada respuesta vale su score (0–100) o, si no lo trae,
// 100 si es correcta y 0 si no.
export function scoreAnswers(answers: readonly AnswerResult[]) {
  const points = answers.map((answer) => answer.score ?? (answer.correct ? 100 : 0))
  return {
    score: points.reduce((sum, value) => sum + value, 0) / (answers.length * 100),
    correctCount: answers.filter((answer) => answer.correct).length,
    totalCount: answers.length,
  }
}

export function rewardFor(rule: ActivityRule, score: number, sessionsToday: number) {
  const dailyLimitReached = rule.dailyRewardLimit !== null && sessionsToday >= rule.dailyRewardLimit
  return {
    xpAwarded: dailyLimitReached ? 0 : Math.round(rule.baseXp * Math.min(1, Math.max(0, score))),
    dailyLimitReached,
  }
}

// ─── Insignias ──────────────────────────────────────────────────────────────

export type AchievementContext = {
  studiedWordCount: number
  totalXp: number
  currentStreak: number
  // XP que se acaba de ganar en esta acción.
  xpAwarded: number
  // La acción fue terminar una partida de un juego.
  completedGame: boolean
}

// Una condición por insignia (Strategy): añadir otra no cambia las existentes.
// El nombre y la descripción viven en la base; aquí solo cuándo se gana.
const ACHIEVEMENT_RULES: Record<string, (context: AchievementContext) => boolean> = {
  'first-step': (context) => context.xpAwarded > 0,
  'five-words': (context) => context.studiedWordCount >= 5,
  'first-game': (context) => context.completedGame,
  'three-day-streak': (context) => context.currentStreak >= 3,
  'xp-500': (context) => context.totalXp >= 500,
}

export function achievementsToUnlock({ available, unlocked, ...context }: AchievementContext & { available: readonly string[]; unlocked: readonly string[] }) {
  return available.filter((id) => !unlocked.includes(id) && ACHIEVEMENT_RULES[id]?.(context) === true)
}
