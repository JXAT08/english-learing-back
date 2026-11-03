import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogRepository } from '../../ports/catalogRepository.js'
import { mapCatalogRows, type CatalogRows } from './mappers.js'

const TABLES = [
  'categories', 'words', 'conversation_scenarios', 'conversation_turns', 'levels',
  'achievement_definitions', 'avatars', 'daily_tips', 'activity_rules',
] as const satisfies readonly (keyof CatalogRows)[]

export function createSupabaseCatalogRepository(client: SupabaseClient): CatalogRepository {
  return {
    async getCatalog() {
      const results = await Promise.all(TABLES.map((table) => client.from(table).select('*')))
      const rows = {} as Record<(typeof TABLES)[number], unknown>
      results.forEach((result, index) => {
        if (result.error) throw new Error(`No se pudo leer ${TABLES[index]}: ${result.error.message}`)
        rows[TABLES[index]] = result.data
      })
      return mapCatalogRows(rows as CatalogRows)
    },
  }
}
