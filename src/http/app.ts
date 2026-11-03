import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppConfig } from '../config/config.js'
import type { CatalogRepository } from '../ports/catalogRepository.js'
import type { Clock } from '../ports/clock.js'
import type { Logger } from '../ports/logger.js'
import { errorBody } from './errors.js'
import { requestLogger } from './middleware/requestLogger.js'
import { accountLifecycleRoutes, type AccountLifecycleServices } from './routes/accountLifecycle.js'
import { catalogRoutes } from './routes/catalog.js'
import { healthRoutes } from './routes/health.js'
import { meRoutes, type MeServices } from './routes/me.js'
import { practiceRoutes, type PracticeServices } from './routes/practice.js'
import type { AppEnv } from './types.js'

// Lo que la capa HTTP necesita: casos de uso y puertos, nunca Supabase directamente.
export type AppServices = MeServices & PracticeServices & AccountLifecycleServices & {
  catalog: CatalogRepository
}

export type AppDependencies = {
  config: AppConfig
  logger: Logger
  clock: Clock
  services: AppServices
}

const MAX_BODY_BYTES = 64 * 1024

// La capa HTTP solo traduce peticiones y respuestas: valida, autentica y
// delega en los casos de uso. No contiene reglas del negocio.
export function createApp({ config, logger, clock, services }: AppDependencies) {
  const app = new Hono<AppEnv>()

  app.use('*', requestId())
  app.use('*', requestLogger(logger))
  app.use('*', secureHeaders())
  app.use('/api/*', cors({
    origin: (origin) => (config.allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Client-Date'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
  }))
  app.use('/api/*', bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (context) => context.json(errorBody('payload_too_large', 'La petición es demasiado grande.', context.var.requestId), 413),
  }))

  app.route('/api/v1', healthRoutes({ clock }))
  app.route('/api/v1', catalogRoutes({ catalog: services.catalog }))
  app.route('/api/v1', meRoutes({ ...services, clock }))
  app.route('/api/v1', practiceRoutes({ ...services, clock }))
  app.route('/api/v1', accountLifecycleRoutes({ ...services, clock }))

  app.notFound((context) => context.json(errorBody('not_found', 'La ruta solicitada no existe.', context.var.requestId), 404))

  app.onError((error, context) => {
    if (error instanceof HTTPException) {
      const status = error.status as ContentfulStatusCode
      return context.json(errorBody('http_error', error.message || 'La petición no se pudo procesar.', context.var.requestId), status)
    }
    logger.error('unhandled_error', { requestId: context.var.requestId, error: error.message })
    return context.json(errorBody('internal_error', 'Ocurrió un error inesperado. Inténtalo nuevamente.', context.var.requestId), 500)
  })

  return app
}
