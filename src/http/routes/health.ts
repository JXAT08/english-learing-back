import { Hono } from 'hono'
import type { Clock } from '../../ports/clock.js'
import type { AppEnv } from '../types.js'

// Render consulta esta ruta para saber si el servicio está vivo.
export function healthRoutes({ clock }: { clock: Clock }) {
  return new Hono<AppEnv>().get('/health', (context) => context.json({ status: 'ok', time: clock.now().toISOString() }))
}
