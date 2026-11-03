import { createGetMyAccount, createUpdateMyPreferences, createUpdateMyProfile } from '../application/account.js'
import { createDeleteMyAccount, createImportGuestProgress } from '../application/guestImport.js'
import { createRecordActivity, createStudyWord } from '../application/practice.js'
import { loadConfig } from '../config/config.js'
import { createApp } from '../http/app.js'
import { createCachedCatalogRepository } from '../infrastructure/catalog/cachedCatalogRepository.js'
import { systemClock } from '../infrastructure/clock/systemClock.js'
import { createJsonLogger } from '../infrastructure/logging/jsonLogger.js'
import { createServerSupabaseClient } from '../infrastructure/supabase/serverClient.js'
import { createSupabaseAccountDeleter } from '../infrastructure/supabase/supabaseAccountDeleter.js'
import { createSupabaseAuthVerifier } from '../infrastructure/supabase/supabaseAuthVerifier.js'
import { createSupabaseCatalogRepository } from '../infrastructure/supabase/supabaseCatalogRepository.js'
import { createSupabasePracticeRepository } from '../infrastructure/supabase/supabasePracticeRepository.js'
import { createSupabaseStudentAccountRepository } from '../infrastructure/supabase/supabaseStudentAccountRepository.js'

const CATALOG_CACHE_MS = 5 * 60 * 1000

// Raíz de composición: el único lugar que conoce las implementaciones reales
// (Supabase, reloj, logs). El resto del código depende de interfaces.
export function createContainer(env: Record<string, string | undefined>, logOutput: { write?: (line: string) => void } = {}) {
  const config = loadConfig(env)
  const logger = createJsonLogger({ level: config.logLevel, write: logOutput.write })
  const clock = systemClock

  const supabase = createServerSupabaseClient(config.supabaseUrl, config.supabaseSecretKey)
  const catalog = createCachedCatalogRepository(createSupabaseCatalogRepository(supabase), { ttlMs: CATALOG_CACHE_MS })
  const accounts = createSupabaseStudentAccountRepository(supabase)
  const practice = createSupabasePracticeRepository(supabase)

  const app = createApp({
    config,
    logger,
    clock,
    services: {
      authVerifier: createSupabaseAuthVerifier(supabase, logger),
      catalog,
      getMyAccount: createGetMyAccount({ accounts, catalog }),
      updateMyProfile: createUpdateMyProfile({ accounts, catalog }),
      updateMyPreferences: createUpdateMyPreferences({ accounts }),
      recordActivity: createRecordActivity({ accounts, catalog, practice }),
      studyWord: createStudyWord({ accounts, catalog, practice }),
      importGuestProgress: createImportGuestProgress({ accounts, catalog, practice }),
      deleteMyAccount: createDeleteMyAccount({ deleter: createSupabaseAccountDeleter(supabase) }),
    },
  })
  return { config, logger, app }
}
