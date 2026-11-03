import type { RequestIdVariables } from 'hono/request-id'
import type { AuthenticatedUser } from '../ports/authVerifier.js'

// Variables que los middleware dejan disponibles en cada petición.
export type AppEnv = {
  Variables: RequestIdVariables & {
    // Solo en rutas protegidas, después de verificar el token.
    user: AuthenticatedUser
  }
}
