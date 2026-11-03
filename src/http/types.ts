import type { RequestIdVariables } from 'hono/request-id'

// Variables que los middleware dejan disponibles en cada petición.
export type AppEnv = {
  Variables: RequestIdVariables
}
