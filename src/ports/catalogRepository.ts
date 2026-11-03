import type { Catalog } from '../domain/catalog.js'

export interface CatalogRepository {
  getCatalog(): Promise<Catalog>
}
