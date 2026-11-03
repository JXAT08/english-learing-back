import type { Context } from 'hono'
import { daysBetween } from '../domain/progress.js'
import type { Clock } from '../ports/clock.js'

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

// La racha se cuenta por días del estudiante (Ecuador va 5 horas por detrás
// de UTC). El frontend envía su fecha local en X-Client-Date; solo se acepta
// si está a un día como mucho de la fecha UTC del servidor.
export function resolveClientDate(context: Context, clock: Clock) {
  const serverDate = clock.now().toISOString().slice(0, 10)
  const clientDate = context.req.header('X-Client-Date')
  if (!clientDate || !CALENDAR_DATE.test(clientDate) || Number.isNaN(Date.parse(clientDate))) return serverDate
  return Math.abs(daysBetween(serverDate, clientDate)) <= 1 ? clientDate : serverDate
}
