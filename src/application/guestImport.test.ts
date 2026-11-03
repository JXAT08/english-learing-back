import { describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '../ports/authVerifier.js'
import { createInMemoryPracticeRepository } from '../testing/inMemoryPracticeRepository.js'
import { createInMemoryAccountRepository, createInMemoryCatalogRepository } from '../testing/inMemoryRepositories.js'
import { createDeleteMyAccount, createImportGuestProgress, IMPORT_XP_CAP, type GuestProgress } from './guestImport.js'
import { createStudyWord } from './practice.js'

const ana: AuthenticatedUser = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', name: 'Ana' }
const TODAY = '2026-11-03'

const guest: GuestProgress = {
  totalXp: 120,
  currentStreak: 2,
  bestStreak: 4,
  lastPracticeDate: '2026-11-02',
  studiedWordIds: ['web-browser', 'web-component', 'web-deploy', 'web-link', 'web-route'],
  unlockedAchievementIds: ['first-step', 'five-words', 'first-game'],
  avatarId: 'robot',
}

function setup() {
  const accounts = createInMemoryAccountRepository()
  const catalog = createInMemoryCatalogRepository()
  const practice = createInMemoryPracticeRepository(accounts)
  return {
    accounts,
    practice,
    importGuest: createImportGuestProgress({ accounts, catalog, practice }),
    studyWord: createStudyWord({ accounts, catalog, practice }),
    stored: () => accounts.accounts.get(ana.id)!,
  }
}

describe('importar el progreso del modo invitado', () => {
  it('sube XP, racha, palabras, insignias recalculadas y avatar a una cuenta nueva', async () => {
    const { importGuest, stored } = setup()

    const result = await importGuest(ana, guest, TODAY)

    expect(result).toEqual({ ok: true, value: { imported: true, importedXp: 120, importedWords: 5, newAchievements: ['first-step', 'five-words', 'first-game'] } })
    expect(stored().progress).toEqual({ totalXp: 120, currentStreak: 2, bestStreak: 4, lastPracticeDate: '2026-11-02' })
    expect(stored().studiedWordIds).toHaveLength(5)
    expect(stored().profile).toMatchObject({ displayName: 'Ana', avatarId: 'robot' })
  })

  it('no importa en una cuenta que ya tiene progreso', async () => {
    const { importGuest, studyWord, stored } = setup()
    await studyWord(ana, 'web-cache', TODAY)

    const result = await importGuest(ana, guest, TODAY)

    expect(result).toEqual({ ok: true, value: { imported: false, reason: 'account_not_empty' } })
    expect(stored().progress.totalXp).toBe(10)
  })

  it('solo se puede importar una vez', async () => {
    const { importGuest, stored } = setup()
    await importGuest(ana, guest, TODAY)

    const second = await importGuest(ana, { ...guest, totalXp: 900 }, TODAY)

    expect(second.ok && second.value).toEqual({ imported: false, reason: 'account_not_empty' })
    expect(stored().progress.totalXp).toBe(120)
  })

  it(`limita la XP importada a ${IMPORT_XP_CAP}`, async () => {
    const { importGuest, stored } = setup()

    await importGuest(ana, { ...guest, totalXp: 99_999 }, TODAY)

    expect(stored().progress.totalXp).toBe(IMPORT_XP_CAP)
  })

  it('ignora palabras e insignias que no existen y no copia insignias no ganadas', async () => {
    const { importGuest, stored } = setup()

    const result = await importGuest(ana, {
      ...guest,
      totalXp: 0,
      studiedWordIds: ['web-browser', 'inventada', 'web-browser'],
      unlockedAchievementIds: ['xp-500', 'insignia-falsa'],
    }, TODAY)

    expect(result.ok && result.value).toMatchObject({ imported: true, importedWords: 1, newAchievements: [] })
    expect(stored().studiedWordIds).toEqual(['web-browser'])
  })

  it('pone la racha en 0 si la última práctica fue hace días y rechaza fechas futuras', async () => {
    const old = setup()
    await old.importGuest(ana, { ...guest, lastPracticeDate: '2026-10-01' }, TODAY)
    expect(old.stored().progress).toMatchObject({ currentStreak: 0, bestStreak: 4, lastPracticeDate: '2026-10-01' })

    const future = setup()
    await future.importGuest(ana, { ...guest, lastPracticeDate: '2027-01-01' }, TODAY)
    expect(future.stored().progress).toMatchObject({ currentStreak: 0, lastPracticeDate: null })
  })

  it('no hace nada si el invitado no tenía progreso', async () => {
    const { importGuest, practice } = setup()

    const result = await importGuest(ana, { ...guest, totalXp: 0, studiedWordIds: [], unlockedAchievementIds: [] }, TODAY)

    expect(result.ok && result.value).toEqual({ imported: false, reason: 'nothing_to_import' })
    expect(practice.writes).toEqual([])
  })
})

describe('borrar la cuenta', () => {
  it('borra la cuenta del estudiante con sesión', async () => {
    const deleted: string[] = []
    const deleteMyAccount = createDeleteMyAccount({ deleter: { async deleteAccount(userId) { deleted.push(userId) } } })

    await deleteMyAccount(ana)

    expect(deleted).toEqual([ana.id])
  })
})
