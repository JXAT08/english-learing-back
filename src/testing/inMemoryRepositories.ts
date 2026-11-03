import type { Catalog, Word } from '../domain/catalog.js'
import { DEFAULT_PREFERENCES } from '../domain/preferences.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { StudentAccount, StudentAccountRepository } from '../ports/studentAccountRepository.js'

// Implementaciones en memoria de los puertos, solo para pruebas.

const testWord = (id: string, term: string): Word => ({
  id, term, translation: term, definition: `${term} definition.`, definitionEs: `Definición de ${term}.`,
  example: `The ${term} example.`, pronunciationPhrase: `The ${term} example.`, pronunciationHint: null, difficulty: 'beginner',
  synonyms: [`${term} synonym`], antonyms: [], keywords: [term.toLowerCase()],
})

export const testCatalog: Catalog = {
  categories: [{
    id: 'web-development',
    name: 'Desarrollo web',
    description: 'Conceptos web.',
    icon: 'code',
    tone: 'violet',
    words: [
      {
        id: 'web-browser', term: 'Browser', translation: 'Navegador', definition: 'A program used to access and display websites.',
        definitionEs: 'Programa para mostrar sitios web.', example: 'The browser displays the new website.',
        pronunciationPhrase: 'The browser displays the new website.', pronunciationHint: 'brau-ser', difficulty: 'beginner',
        synonyms: ['web browser'], antonyms: [], keywords: ['program', 'website', 'display'],
      },
      testWord('web-component', 'Component'),
      testWord('web-deploy', 'Deploy'),
      testWord('web-link', 'Link'),
      testWord('web-route', 'Route'),
      testWord('web-cache', 'Cache'),
    ],
  }],
  conversationScenarios: [{
    id: 'daily-standup',
    title: 'Daily development stand-up',
    description: 'Practica una reunión diaria.',
    turns: [{ id: 'standup-task', botMessage: 'What task are you working on?', criteria: ['working', 'task'], alternatives: {}, suggestion: 'Try: I am working on the task.' }],
  }],
  levels: [
    { level: 1, name: 'Principiante', minimumXp: 0 },
    { level: 2, name: 'Aprendiz', minimumXp: 100 },
  ],
  achievements: [
    { id: 'first-step', name: 'Primer paso', description: 'Obtén tu primera recompensa.' },
    { id: 'five-words', name: 'Explorador de palabras', description: 'Estudia 5 palabras únicas.' },
    { id: 'first-game', name: 'Primera partida', description: 'Completa tu primera partida.' },
  ],
  avatars: [
    { id: 'default-student', label: 'Estudiante', tone: 'violet' },
    { id: 'robot', label: 'Robot', tone: 'rose' },
  ],
  dailyTips: ['Practica en voz alta.'],
  activityRules: [
    { activity: 'word-study', baseXp: 10, dailyRewardLimit: null },
    { activity: 'definition', baseXp: 25, dailyRewardLimit: 3 },
    { activity: 'conversation', baseXp: 30, dailyRewardLimit: 3 },
  ],
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
