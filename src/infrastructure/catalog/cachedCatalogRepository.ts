import type { Catalog } from '../../domain/catalog.js'
import type { CatalogRepository } from '../../ports/catalogRepository.js'

type Options = { ttlMs: number; now?: () => number }

// Decorador: misma interfaz que el repositorio real, pero guarda el catálogo en
// memoria. El contenido cambia muy poco y lo piden todas las pantallas.
export function createCachedCatalogRepository(inner: CatalogRepository, { ttlMs, now = () => Date.now() }: Options): CatalogRepository {
  let cached: { expiresAt: number; catalog: Promise<Catalog> } | null = null

  return {
    getCatalog() {
      if (cached && now() < cached.expiresAt) return cached.catalog
      const catalog = inner.getCatalog()
      const entry = { expiresAt: now() + ttlMs, catalog }
      cached = entry
      // Una lectura fallida no se queda en caché: la siguiente petición reintenta.
      catalog.catch(() => {
        if (cached === entry) cached = null
      })
      return catalog
    },
  }
}
