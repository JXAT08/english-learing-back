import type { MiddlewareHandler } from 'hono'
import type { Logger } from '../../ports/logger.js'
import type { AppEnv } from '../types.js'

// Registra método, ruta (sin la cadena de consulta, que puede llevar datos
// privados), estado y duración de cada petición.
export function requestLogger(logger: Logger, now: () => number = () => performance.now()): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const startedAt = now()
    await next()
    logger.info('request', {
      requestId: context.var.requestId,
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Math.round(now() - startedAt),
    })
  }
}
