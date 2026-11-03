import type { Preferences } from '../domain/preferences.js'
import { DEFAULT_AVATAR_ID, initialDisplayName, validateDisplayName, type Profile } from '../domain/profile.js'
import { effectiveStreak, levelFor } from '../domain/progress.js'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { ProfileChanges, StudentAccount, StudentAccountRepository, UnlockedAchievement } from '../ports/studentAccountRepository.js'
import { fail, ok, type Result } from '../shared/result.js'

export type AccountView = {
  profile: Profile
  progress: {
    totalXp: number
    level: number
    levelName: string
    nextLevelXp: number | null
    levelProgressPercentage: number
    currentStreak: number
    bestStreak: number
    lastPracticeDate: string | null
  }
  preferences: Preferences
  studiedWordIds: string[]
  achievements: UnlockedAchievement[]
}

// La primera petición de un estudiante crea su cuenta con el nombre de Google.
async function ensureAccount(accounts: StudentAccountRepository, user: AuthenticatedUser): Promise<StudentAccount> {
  return (await accounts.findAccount(user.id))
    ?? accounts.createAccount(user.id, { displayName: initialDisplayName(user.name), avatarId: DEFAULT_AVATAR_ID })
}

export function createGetMyAccount({ accounts, catalog }: { accounts: StudentAccountRepository; catalog: CatalogRepository }) {
  // today: fecha del calendario del estudiante, para saber si su racha sigue viva.
  return async (user: AuthenticatedUser, today: string): Promise<AccountView> => {
    const [account, { levels }] = await Promise.all([ensureAccount(accounts, user), catalog.getCatalog()])
    const standing = levelFor(account.progress.totalXp, levels)
    return {
      profile: account.profile,
      progress: {
        totalXp: account.progress.totalXp,
        level: standing.level,
        levelName: standing.name,
        nextLevelXp: standing.nextLevelXp,
        levelProgressPercentage: standing.progressPercentage,
        currentStreak: effectiveStreak(account.progress, today),
        bestStreak: account.progress.bestStreak,
        lastPracticeDate: account.progress.lastPracticeDate,
      },
      preferences: account.preferences,
      studiedWordIds: account.studiedWordIds,
      achievements: account.achievements,
    }
  }
}

export function createUpdateMyProfile({ accounts, catalog }: { accounts: StudentAccountRepository; catalog: CatalogRepository }) {
  return async (user: AuthenticatedUser, changes: ProfileChanges): Promise<Result<Profile>> => {
    const name = validateDisplayName(changes.displayName)
    if (!name.ok) return name
    const { avatars } = await catalog.getCatalog()
    if (!avatars.some((avatar) => avatar.id === changes.avatarId)) return fail('validation_error', 'El avatar elegido no existe.')
    await ensureAccount(accounts, user)
    return ok(await accounts.updateProfile(user.id, { displayName: name.value, avatarId: changes.avatarId }))
  }
}

export function createUpdateMyPreferences({ accounts }: { accounts: StudentAccountRepository }) {
  return async (user: AuthenticatedUser, preferences: Preferences): Promise<Preferences> => {
    await ensureAccount(accounts, user)
    return accounts.updatePreferences(user.id, preferences)
  }
}
