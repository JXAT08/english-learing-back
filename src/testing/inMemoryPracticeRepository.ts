import type { PracticeRepository, PracticeWrite, PracticeWriteResult } from '../ports/practiceRepository.js'
import type { createInMemoryAccountRepository } from './inMemoryRepositories.js'

type StoredSession = NonNullable<PracticeWrite['session']> & { userId: string }

// Imita apply_practice sobre las cuentas en memoria, incluida la versión del
// progreso. `conflictsToSimulate` fuerza conflictos para probar los reintentos.
export function createInMemoryPracticeRepository(accounts: ReturnType<typeof createInMemoryAccountRepository>) {
  const versions = new Map<string, number>()
  const sessions: StoredSession[] = []
  const repository: PracticeRepository & { sessions: StoredSession[]; writes: PracticeWrite[]; conflictsToSimulate: number } = {
    sessions,
    writes: [],
    conflictsToSimulate: 0,
    async loadSnapshot(userId, activity, practicedOn) {
      const account = accounts.accounts.get(userId)!
      return {
        progress: { ...account.progress },
        version: versions.get(userId) ?? 0,
        studiedWordIds: [...account.studiedWordIds],
        achievementIds: account.achievements.map((achievement) => achievement.id),
        sessionsToday: sessions.filter((session) => session.userId === userId && session.activity === activity && session.practicedOn === practicedOn).length,
      }
    },
    async findSessionXp(userId, eventId) {
      return sessions.find((session) => session.userId === userId && session.eventId === eventId)?.xpAwarded ?? null
    },
    async apply(userId, write): Promise<PracticeWriteResult> {
      if (repository.conflictsToSimulate > 0) {
        repository.conflictsToSimulate -= 1
        versions.set(userId, (versions.get(userId) ?? 0) + 1)
        return 'conflict'
      }
      if ((versions.get(userId) ?? 0) !== write.expectedVersion) return 'conflict'
      if (write.session && sessions.some((session) => session.userId === userId && session.eventId === write.session!.eventId)) return 'duplicate'
      repository.writes.push(structuredClone(write))
      const account = accounts.accounts.get(userId)!
      if (write.session) sessions.push({ ...write.session, userId })
      account.progress = { ...write.progress }
      for (const word of write.words) if (!account.studiedWordIds.includes(word.wordId)) account.studiedWordIds.push(word.wordId)
      for (const id of write.achievements) account.achievements.push({ id, unlockedAt: '2026-11-03T15:00:00.000Z' })
      versions.set(userId, (versions.get(userId) ?? 0) + 1)
      return 'applied'
    },
  }
  return repository
}
