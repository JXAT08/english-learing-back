import { createGetMyAccount, createUpdateMyPreferences, createUpdateMyProfile } from '../application/account.js'
import { createRecordActivity, createStudyWord } from '../application/practice.js'
import type { AppServices } from '../http/app.js'
import type { AuthVerifier } from '../ports/authVerifier.js'
import { createInMemoryPracticeRepository } from './inMemoryPracticeRepository.js'
import { createInMemoryAccountRepository, createInMemoryCatalogRepository } from './inMemoryRepositories.js'

export const ANA_TOKEN = 'token-de-ana'
export const ANA_ID = '11111111-1111-4111-8111-111111111111'

// Verificador falso: solo reconoce el token de Ana.
export const fakeAuthVerifier: AuthVerifier = {
  async verify(token) {
    return token === ANA_TOKEN ? { id: ANA_ID, email: 'ana@example.com', name: 'Ana Lucía' } : null
  },
}

export function createTestServices(): AppServices & { accounts: ReturnType<typeof createInMemoryAccountRepository> } {
  const accounts = createInMemoryAccountRepository()
  const catalog = createInMemoryCatalogRepository()
  const practice = createInMemoryPracticeRepository(accounts)
  return {
    accounts,
    authVerifier: fakeAuthVerifier,
    catalog,
    getMyAccount: createGetMyAccount({ accounts, catalog }),
    updateMyProfile: createUpdateMyProfile({ accounts, catalog }),
    updateMyPreferences: createUpdateMyPreferences({ accounts }),
    recordActivity: createRecordActivity({ accounts, catalog, practice }),
    studyWord: createStudyWord({ accounts, catalog, practice }),
  }
}
