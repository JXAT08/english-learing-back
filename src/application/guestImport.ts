import { achievementsToUnlock } from '../domain/gameRules.js'
import { daysBetween } from '../domain/progress.js'
import type { AccountDeleter } from '../ports/accountDeleter.js'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { PracticeRepository } from '../ports/practiceRepository.js'
import type { StudentAccountRepository } from '../ports/studentAccountRepository.js'
import { ok, type Result } from '../shared/result.js'
import { ensureAccount } from './account.js'

// Lo que el navegador guardó mientras el estudiante usaba la app sin sesión.
export type GuestProgress = {
  totalXp: number
  currentStreak: number
  bestStreak: number
  lastPracticeDate: string | null
  studiedWordIds: string[]
  unlockedAchievementIds: string[]
  avatarId?: string
}

export type ImportOutcome =
  | { imported: true; importedXp: number; importedWords: number; newAchievements: string[] }
  | { imported: false; reason: 'account_not_empty' | 'nothing_to_import' }

// Los datos del invitado vienen del navegador y no se pueden comprobar: se
// importan una sola vez, en una cuenta vacía y con la XP limitada.
export const IMPORT_XP_CAP = 1000
const STREAK_CAP = 365
const MAX_ATTEMPTS = 3

type Dependencies = { accounts: StudentAccountRepository; catalog: CatalogRepository; practice: PracticeRepository }

export function createImportGuestProgress({ accounts, catalog: catalogRepository, practice }: Dependencies) {
  return async (user: AuthenticatedUser, guest: GuestProgress, today: string): Promise<Result<ImportOutcome>> => {
    const catalog = await catalogRepository.getCatalog()
    await ensureAccount(accounts, user)
    const validWordIds = new Set(catalog.categories.flatMap((category) => category.words.map((word) => word.id)))

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const snapshot = await practice.loadSnapshot(user.id, null, today)
      const untouched = snapshot.progress.totalXp === 0 && snapshot.studiedWordIds.length === 0 && snapshot.progress.lastPracticeDate === null
      if (!untouched) return ok({ imported: false, reason: 'account_not_empty' })

      const words = [...new Set(guest.studiedWordIds)].filter((wordId) => validWordIds.has(wordId))
      const totalXp = Math.min(Math.max(0, Math.trunc(guest.totalXp)), IMPORT_XP_CAP)
      if (totalXp === 0 && words.length === 0) return ok({ imported: false, reason: 'nothing_to_import' })

      // Una fecha futura no es creíble; una antigua conserva la mejor racha pero no la actual.
      const lastPracticeDate = guest.lastPracticeDate && guest.lastPracticeDate <= today ? guest.lastPracticeDate : null
      const currentStreak = lastPracticeDate && daysBetween(lastPracticeDate, today) <= 1 ? Math.min(guest.currentStreak, STREAK_CAP) : 0
      const progress = {
        totalXp,
        currentStreak,
        bestStreak: Math.max(Math.min(guest.bestStreak, STREAK_CAP), currentStreak),
        lastPracticeDate,
      }
      // Las insignias se recalculan con las reglas; solo "primera partida"
      // depende de lo que diga el invitado, porque no hay partidas que contar.
      const newAchievements = achievementsToUnlock({
        available: catalog.achievements.map((achievement) => achievement.id),
        unlocked: [],
        studiedWordCount: words.length,
        totalXp,
        currentStreak,
        xpAwarded: totalXp,
        completedGame: guest.unlockedAchievementIds.includes('first-game'),
      })

      const result = await practice.apply(user.id, {
        expectedVersion: snapshot.version,
        progress,
        session: null,
        answers: [],
        words: words.map((wordId) => ({ wordId, source: 'guest-import' as const })),
        achievements: newAchievements,
      })
      if (result === 'conflict') continue

      if (guest.avatarId && catalog.avatars.some((avatar) => avatar.id === guest.avatarId)) {
        const account = await ensureAccount(accounts, user)
        await accounts.updateProfile(user.id, { displayName: account.profile.displayName, avatarId: guest.avatarId })
      }
      return ok({ imported: true, importedXp: totalXp, importedWords: words.length, newAchievements })
    }
    throw new Error('Conflicto persistente al importar el progreso de invitado')
  }
}

export function createDeleteMyAccount({ deleter }: { deleter: AccountDeleter }) {
  return async (user: AuthenticatedUser) => deleter.deleteAccount(user.id)
}
