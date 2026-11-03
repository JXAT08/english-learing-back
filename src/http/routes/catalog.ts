import { Hono } from 'hono'
import type { CatalogRepository } from '../../ports/catalogRepository.js'
import type { AppEnv } from '../types.js'

// Contenido público: no requiere sesión y el navegador puede guardarlo 5 minutos.
export function catalogRoutes({ catalog }: { catalog: CatalogRepository }) {
  return new Hono<AppEnv>().get('/catalog', async (context) => {
    context.header('Cache-Control', 'public, max-age=300')
    return context.json(await catalog.getCatalog())
  })
}
