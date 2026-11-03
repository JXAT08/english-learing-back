import { describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import { createInMemoryAccountRepository, createInMemoryCatalogRepository } from '../testing/inMemoryRepositories.js'
import { createGetMyAccount, createUpdateMyPreferences, createUpdateMyProfile } from './account.js'

const ana: AuthenticatedUser = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', name: 'Ana Lucía' }

function setup() {
  const accounts = createInMemoryAccountRepository()
  const catalog = createInMemoryCatalogRepository()
  return {
    accounts,
    getMyAccount: createGetMyAccount({ accounts, catalog }),
    updateMyProfile: createUpdateMyProfile({ accounts, catalog }),
    updateMyPreferences: createUpdateMyPreferences({ accounts }),
  }
}

describe('cuenta del estudiante', () => {
  it('la primera vez crea la cuenta con el nombre de Google y valores iniciales', async () => {
    const { getMyAccount } = setup()

    const account = await getMyAccount(ana, '2026-11-03')

    expect(account).toEqual({
      profile: { displayName: 'Ana Lucía', avatarId: 'default-student', createdAt: '2026-11-03T10:00:00.000Z' },
      progress: { totalXp: 0, level: 1, levelName: 'Principiante', nextLevelXp: 100, levelProgressPercentage: 0, currentStreak: 0, bestStreak: 0, lastPracticeDate: null },
      preferences: { soundEnabled: true, speechEngine: 'auto' },
      studiedWordIds: [],
      achievements: [],
    })
  })

  it('no vuelve a crear la cuenta en las siguientes visitas', async () => {
    const { getMyAccount, accounts } = setup()

    await getMyAccount(ana, '2026-11-03')
    await getMyAccount(ana, '2026-11-03')

    expect(accounts.creations).toBe(1)
  })

  it('calcula el nivel y la racha visible a partir de lo guardado', async () => {
    const { getMyAccount, accounts } = setup()
    await getMyAccount(ana, '2026-11-03')
    const stored = accounts.accounts.get(ana.id)!
    stored.progress = { totalXp: 150, currentStreak: 5, bestStreak: 7, lastPracticeDate: '2026-10-20' }

    const { progress } = await getMyAccount(ana, '2026-11-03')

    expect(progress).toMatchObject({ level: 2, levelName: 'Aprendiz', currentStreak: 0, bestStreak: 7 })
  })

  it('actualiza nombre y avatar válidos', async () => {
    const { updateMyProfile } = setup()

    const result = await updateMyProfile(ana, { displayName: '  Ana  ', avatarId: 'robot' })

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ displayName: 'Ana', avatarId: 'robot' }) })
  })

  it.each([
    ['un nombre demasiado corto', { displayName: 'A', avatarId: 'robot' }, /al menos 2/],
    ['un avatar que no existe', { displayName: 'Ana', avatarId: 'dragon' }, /avatar/],
  ])('rechaza %s sin guardar nada', async (_case, changes, message) => {
    const { updateMyProfile, getMyAccount } = setup()

    const result = await updateMyProfile(ana, changes)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toEqual({ code: 'validation_error', message: expect.stringMatching(message) })
    expect((await getMyAccount(ana, '2026-11-03')).profile.displayName).toBe('Ana Lucía')
  })

  it('guarda las preferencias de sonido y motor de voz', async () => {
    const { updateMyPreferences, getMyAccount } = setup()

    await updateMyPreferences(ana, { soundEnabled: false, speechEngine: 'local' })

    expect((await getMyAccount(ana, '2026-11-03')).preferences).toEqual({ soundEnabled: false, speechEngine: 'local' })
  })
})
