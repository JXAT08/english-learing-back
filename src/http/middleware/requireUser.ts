import type { MiddlewareHandler } from 'hono'
import type { AuthVerifier } from '../../ports/authVerifier.js'
import { errorBody } from '../errors.js'
import type { AppEnv } from '../types.js'

const BEARER = /^Bearer\s+(.+)$/i

// Exige el token de sesión de Supabase (Authorization: Bearer …) y deja al
// estudiante verificado en la petición. Sin token válido: 401.
export function requireUser(authVerifier: AuthVerifier): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const token = context.req.header('Authorization')?.match(BEARER)?.[1]
    const user = token ? await authVerifier.verify(token) : null
    if (!user) {
      return context.json(errorBody('unauthorized', 'Inicia sesión para continuar.', context.var.requestId), 401)
    }
    context.set('user', user)
    await next()
  }
}
