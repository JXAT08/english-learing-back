import { Hono } from 'hono'
import { z } from 'zod'
import type { AccountView } from '../../application/account.js'
import type { ActivityInput, PracticeOutcome } from '../../application/practice.js'
import type { AuthenticatedUser, AuthVerifier } from '../../ports/authVerifier.js'
import type { Clock } from '../../ports/clock.js'
import type { Result } from '../../shared/result.js'
import { resolveClientDate } from '../clientDate.js'
import { requireUser } from '../middleware/requireUser.js'
import type { AppEnv } from '../types.js'
import { domainErrorResponse, parseJsonBody } from '../validation.js'

export type PracticeServices = {
  authVerifier: AuthVerifier
  getMyAccount: (user: AuthenticatedUser, today: string) => Promise<AccountView>
  recordActivity: (user: AuthenticatedUser, input: ActivityInput, today: string) => Promise<Result<PracticeOutcome>>
  studyWord: (user: AuthenticatedUser, wordId: string, today: string) => Promise<Result<PracticeOutcome>>
}

const MAX_ANSWERS = 20

// El frontend informa qué respondió; el backend calcula la puntuación y la XP.
const activitySchema = z.object({
  eventId: z.string().min(1).max(100).regex(/^[\w:.-]+$/),
  activity: z.string().min(1).max(50),
  answers: z.array(z.object({
    wordId: z.string().min(1).max(100).optional(),
    turnId: z.string().min(1).max(100).optional(),
    correct: z.boolean(),
    // 0–100. De la pronunciación solo llega la puntuación, nunca audio ni texto.
    score: z.number().int().min(0).max(100).optional(),
  })).min(1).max(MAX_ANSWERS),
})

export function practiceRoutes({ authVerifier, getMyAccount, recordActivity, studyWord, clock }: PracticeServices & { clock: Clock }) {
  return new Hono<AppEnv>()
    .use('/me/activities', requireUser(authVerifier))
    .use('/me/words/*', requireUser(authVerifier))
    .post('/me/activities', async (context) => {
      const body = await parseJsonBody(context, activitySchema)
      if (!body.ok) return body.response
      const today = resolveClientDate(context, clock)
      const result = await recordActivity(context.var.user, body.value, today)
      if (!result.ok) return domainErrorResponse(context, result.error)
      return context.json({ reward: result.value, account: await getMyAccount(context.var.user, today) })
    })
    .post('/me/words/:wordId/study', async (context) => {
      const today = resolveClientDate(context, clock)
      const result = await studyWord(context.var.user, context.req.param('wordId'), today)
      if (!result.ok) return domainErrorResponse(context, result.error)
      return context.json({ reward: result.value, account: await getMyAccount(context.var.user, today) })
    })
}
