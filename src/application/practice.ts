import type { Catalog } from '../domain/catalog.js'
import { achievementsToUnlock, advanceStreak, rewardFor, scoreAnswers } from '../domain/gameRules.js'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { PracticeAnswer, PracticeRepository, PracticeSnapshot, PracticeWrite } from '../ports/practiceRepository.js'
import type { StudentAccountRepository } from '../ports/studentAccountRepository.js'
import { fail, ok, type Result } from '../shared/result.js'
import { ensureAccount } from './account.js'

export type PracticeOutcome = {
  xpAwarded: number
  dailyLimitReached: boolean
  newAchievements: string[]
  // La acción ya estaba registrada: no se sumó nada nuevo.
  duplicate: boolean
}

export type ActivityInput = {
  // Lo genera el frontend por partida; un reintento con el mismo id no suma dos veces.
  eventId: string
  activity: string
  answers: PracticeAnswer[]
}

type Dependencies = { accounts: StudentAccountRepository; catalog: CatalogRepository; practice: PracticeRepository }

const WORD_STUDY = 'word-study'
const MAX_ATTEMPTS = 3

// Lee, calcula y escribe. Si el progreso cambió entre la lectura y la
// escritura (otra petición del mismo estudiante), vuelve a calcular.
async function withRetries(attempt: () => Promise<PracticeOutcome | 'conflict'>): Promise<PracticeOutcome> {
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const outcome = await attempt()
    if (outcome !== 'conflict') return outcome
  }
  throw new Error('Conflicto persistente al guardar la práctica')
}

function unlockedAfter(catalog: Catalog, snapshot: PracticeSnapshot, write: Pick<PracticeWrite, 'progress' | 'words'>, xpAwarded: number, completedGame: boolean) {
  return achievementsToUnlock({
    available: catalog.achievements.map((achievement) => achievement.id),
    unlocked: snapshot.achievementIds,
    studiedWordCount: snapshot.studiedWordIds.length + write.words.length,
    totalXp: write.progress.totalXp,
    currentStreak: write.progress.currentStreak,
    xpAwarded,
    completedGame,
  })
}

function validateAnswers(catalog: Catalog, answers: PracticeAnswer[]): Result<null> {
  const wordIds = new Set(catalog.categories.flatMap((category) => category.words.map((word) => word.id)))
  const turnIds = new Set(catalog.conversationScenarios.flatMap((scenario) => scenario.turns.map((turn) => turn.id)))
  if (answers.some((answer) => answer.wordId !== undefined && !wordIds.has(answer.wordId))) return fail('validation_error', 'Una respuesta menciona una palabra que no existe.')
  if (answers.some((answer) => answer.turnId !== undefined && !turnIds.has(answer.turnId))) return fail('validation_error', 'Una respuesta menciona un turno de conversación que no existe.')
  return ok(null)
}

export function createRecordActivity({ accounts, catalog: catalogRepository, practice }: Dependencies) {
  return async (user: AuthenticatedUser, input: ActivityInput, today: string): Promise<Result<PracticeOutcome>> => {
    const catalog = await catalogRepository.getCatalog()
    const rule = catalog.activityRules.find((candidate) => candidate.activity === input.activity && candidate.activity !== WORD_STUDY)
    if (!rule) return fail('validation_error', 'La actividad no existe.')
    const valid = validateAnswers(catalog, input.answers)
    if (!valid.ok) return valid
    await ensureAccount(accounts, user)

    return ok(await withRetries(async () => {
      const previousXp = await practice.findSessionXp(user.id, input.eventId)
      if (previousXp !== null) return { xpAwarded: previousXp, dailyLimitReached: false, newAchievements: [], duplicate: true }

      const snapshot = await practice.loadSnapshot(user.id, input.activity, today)
      const { score, correctCount, totalCount } = scoreAnswers(input.answers)
      const reward = rewardFor(rule, score, snapshot.sessionsToday)
      const streak = advanceStreak(snapshot.progress, today)
      const progress = { ...streak, totalXp: streak.totalXp + reward.xpAwarded }
      // Una palabra acertada en un juego cuenta como estudiada (sin XP extra).
      const words = [...new Set(input.answers.filter((answer) => answer.correct && answer.wordId).map((answer) => answer.wordId!))]
        .filter((wordId) => !snapshot.studiedWordIds.includes(wordId))
        .map((wordId) => ({ wordId, source: 'practice' as const }))
      const newAchievements = unlockedAfter(catalog, snapshot, { progress, words }, reward.xpAwarded, true)

      const result = await practice.apply(user.id, {
        expectedVersion: snapshot.version,
        progress,
        session: { eventId: input.eventId, activity: input.activity, score, xpAwarded: reward.xpAwarded, correctCount, totalCount, practicedOn: today },
        answers: input.answers,
        words,
        achievements: newAchievements,
      })
      if (result === 'conflict') return 'conflict'
      if (result === 'duplicate') {
        return { xpAwarded: (await practice.findSessionXp(user.id, input.eventId)) ?? 0, dailyLimitReached: false, newAchievements: [], duplicate: true }
      }
      return { ...reward, newAchievements, duplicate: false }
    }))
  }
}

export function createStudyWord({ accounts, catalog: catalogRepository, practice }: Dependencies) {
  return async (user: AuthenticatedUser, wordId: string, today: string): Promise<Result<PracticeOutcome>> => {
    const catalog = await catalogRepository.getCatalog()
    if (!catalog.categories.some((category) => category.words.some((word) => word.id === wordId))) {
      return fail('not_found', 'La palabra no existe.')
    }
    const rule = catalog.activityRules.find((candidate) => candidate.activity === WORD_STUDY)
    await ensureAccount(accounts, user)

    return ok(await withRetries(async () => {
      const snapshot = await practice.loadSnapshot(user.id, null, today)
      if (snapshot.studiedWordIds.includes(wordId)) return { xpAwarded: 0, dailyLimitReached: false, newAchievements: [], duplicate: true }

      const xpAwarded = rule?.baseXp ?? 0
      const streak = advanceStreak(snapshot.progress, today)
      const progress = { ...streak, totalXp: streak.totalXp + xpAwarded }
      const words = [{ wordId, source: 'resources' as const }]
      const newAchievements = unlockedAfter(catalog, snapshot, { progress, words }, xpAwarded, false)

      const result = await practice.apply(user.id, { expectedVersion: snapshot.version, progress, session: null, answers: [], words, achievements: newAchievements })
      if (result === 'conflict') return 'conflict'
      return { xpAwarded, dailyLimitReached: false, newAchievements, duplicate: false }
    }))
  }
}
