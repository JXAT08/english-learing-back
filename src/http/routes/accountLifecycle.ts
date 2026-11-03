import { Hono } from 'hono'
import { z } from 'zod'
import type { AccountView } from '../../application/account.js'
import type { GuestProgress, ImportOutcome } from '../../application/guestImport.js'
import type { AuthenticatedUser, AuthVerifier } from '../../ports/authVerifier.js'
import type { Clock } from '../../ports/clock.js'
import type { Result } from '../../shared/result.js'
import { resolveClientDate } from '../clientDate.js'
import { requireUser } from '../middleware/requireUser.js'
import type { AppEnv } from '../types.js'
import { domainErrorResponse, parseJsonBody } from '../validation.js'

export type AccountLifecycleServices = {
  authVerifier: AuthVerifier
  getMyAccount: (user: AuthenticatedUser, today: string) => Promise<AccountView>
  importGuestProgress: (user: AuthenticatedUser, guest: GuestProgress, today: string) => Promise<Result<ImportOutcome>>
  deleteMyAccount: (user: AuthenticatedUser) => Promise<void>
}

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().min(1).max(100)

const guestSchema = z.object({
  totalXp: z.number().int().min(0).max(1_000_000),
  currentStreak: z.number().int().min(0).max(10_000),
  bestStreak: z.number().int().min(0).max(10_000),
  lastPracticeDate: calendarDate.nullable(),
  studiedWordIds: z.array(id).max(200),
  unlockedAchievementIds: z.array(id).max(50),
  avatarId: id.optional(),
})

// Borrar es irreversible: se exige confirmarlo en el cuerpo de la petición.
const deleteSchema = z.object({ confirm: z.literal(true) })

export function accountLifecycleRoutes({ authVerifier, getMyAccount, importGuestProgress, deleteMyAccount, clock }: AccountLifecycleServices & { clock: Clock }) {
  return new Hono<AppEnv>()
    .use('/me/import', requireUser(authVerifier))
    .post('/me/import', async (context) => {
      const body = await parseJsonBody(context, guestSchema)
      if (!body.ok) return body.response
      const today = resolveClientDate(context, clock)
      const result = await importGuestProgress(context.var.user, body.value, today)
      if (!result.ok) return domainErrorResponse(context, result.error)
      return context.json({ result: result.value, account: await getMyAccount(context.var.user, today) })
    })
    .delete('/me', requireUser(authVerifier), async (context) => {
      const body = await parseJsonBody(context, deleteSchema)
      if (!body.ok) return body.response
      await deleteMyAccount(context.var.user)
      return context.body(null, 204)
    })
}
