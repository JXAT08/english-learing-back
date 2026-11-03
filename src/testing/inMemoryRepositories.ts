import type { Catalog } from '../domain/catalog.js'
import { DEFAULT_PREFERENCES } from '../domain/preferences.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { StudentAccount, StudentAccountRepository } from '../ports/studentAccountRepository.js'

// Implementaciones en memoria de los puertos, solo para pruebas.

export const testCatalog: Catalog = {
  categories: [{
    id: 'web-development',
    name: 'Desarrollo web',
    description: 'Conceptos web.',
    icon: 'code',
    tone: 'violet',
    words: [{
      id: 'web-browser', term: 'Browser', translation: 'Navegador', definition: 'A program used to access and display websites.',
      definitionEs: 'Programa para mostrar sitios web.', example: 'The browser displays the new website.',
      pronunciationPhrase: 'The browser displays the new website.', pronunciationHint: 'brau-ser', difficulty: 'beginner',
      synonyms: ['web browser'], antonyms: [], keywords: ['program', 'website', 'display'],
    }],
  }],
  conversationScenarios: [],
  levels: [
    { level: 1, name: 'Principiante', minimumXp: 0 },
    { level: 2, name: 'Aprendiz', minimumXp: 100 },
  ],
  achievements: [{ id: 'first-step', name: 'Primer paso', description: 'Obtén tu primera recompensa.' }],
  avatars: [
    { id: 'default-student', label: 'Estudiante', tone: 'violet' },
    { id: 'robot', label: 'Robot', tone: 'rose' },
  ],
  dailyTips: ['Practica en voz alta.'],
  activityRules: [{ activity: 'definition', baseXp: 25, dailyRewardLimit: 3 }],
}

export function createInMemoryCatalogRepository(catalog: Catalog = testCatalog): CatalogRepository & { reads: number } {
  const repository = {
    reads: 0,
    async getCatalog() {
      repository.reads += 1
      return structuredClone(catalog)
    },
  }
  return repository
}

export function createInMemoryAccountRepository(now: () => Date = () => new Date('2026-11-03T10:00:00.000Z')) {
  const accounts = new Map<string, StudentAccount>()
  const repository: StudentAccountRepository & { accounts: Map<string, StudentAccount>; creations: number } = {
    accounts,
    creations: 0,
    async findAccount(userId) {
      const account = accounts.get(userId)
      return account ? structuredClone(account) : null
    },
    async createAccount(userId, profile) {
      if (!accounts.has(userId)) {
        repository.creations += 1
        accounts.set(userId, {
          profile: { ...profile, createdAt: now().toISOString() },
          progress: { totalXp: 0, currentStreak: 0, bestStreak: 0, lastPracticeDate: null },
          preferences: { ...DEFAULT_PREFERENCES },
          studiedWordIds: [],
          achievements: [],
        })
      }
      return structuredClone(accounts.get(userId)!)
    },
    async updateProfile(userId, changes) {
      const account = accounts.get(userId)!
      account.profile = { ...account.profile, ...changes }
      return { ...account.profile }
    },
    async updatePreferences(userId, preferences) {
      accounts.get(userId)!.preferences = { ...preferences }
      return { ...preferences }
    },
  }
  return repository
}
