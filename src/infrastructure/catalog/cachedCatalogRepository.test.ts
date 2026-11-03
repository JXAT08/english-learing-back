import { describe, expect, it } from 'vitest'
import type { CatalogRepository } from '../../ports/catalogRepository.js'
import { createInMemoryCatalogRepository, testCatalog } from '../../testing/inMemoryRepositories.js'
import { createCachedCatalogRepository } from './cachedCatalogRepository.js'

describe('catálogo en caché', () => {
  it('reutiliza el catálogo mientras no caduque y lo vuelve a leer después', async () => {
    let now = 0
    const inner = createInMemoryCatalogRepository()
    const cached = createCachedCatalogRepository(inner, { ttlMs: 300_000, now: () => now })

    await cached.getCatalog()
    now = 299_999
    await cached.getCatalog()
    expect(inner.reads).toBe(1)

    now = 300_000
    await cached.getCatalog()
    expect(inner.reads).toBe(2)
  })

  it('comparte una sola lectura entre peticiones simultáneas', async () => {
    const inner = createInMemoryCatalogRepository()
    const cached = createCachedCatalogRepository(inner, { ttlMs: 300_000, now: () => 0 })

    await Promise.all([cached.getCatalog(), cached.getCatalog(), cached.getCatalog()])

    expect(inner.reads).toBe(1)
  })

  it('no guarda en caché una lectura fallida', async () => {
    let fails = true
    const inner: CatalogRepository = {
      async getCatalog() {
        if (fails) throw new Error('Supabase no responde')
        return testCatalog
      },
    }
    const cached = createCachedCatalogRepository(inner, { ttlMs: 300_000, now: () => 0 })

    await expect(cached.getCatalog()).rejects.toThrow('Supabase no responde')
    fails = false
    await expect(cached.getCatalog()).resolves.toEqual(testCatalog)
  })
})
