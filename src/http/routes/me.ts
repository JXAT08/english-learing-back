import { Hono } from 'hono'
import { z } from 'zod'
import type { AccountView } from '../../application/account.js'
import { SPEECH_ENGINES, type Preferences } from '../../domain/preferences.js'
import type { Profile } from '../../domain/profile.js'
import type { AuthenticatedUser, AuthVerifier } from '../../ports/authVerifier.js'
import type { Clock } from '../../ports/clock.js'
import type { ProfileChanges } from '../../ports/studentAccountRepository.js'
import type { Result } from '../../shared/result.js'
import { resolveClientDate } from '../clientDate.js'
import { requireUser } from '../middleware/requireUser.js'
import type { AppEnv } from '../types.js'
import { domainErrorResponse, parseJsonBody } from '../validation.js'

export type MeServices = {
  authVerifier: AuthVerifier
  getMyAccount: (user: AuthenticatedUser, today: string) => Promise<AccountView>
  updateMyProfile: (user: AuthenticatedUser, changes: ProfileChanges) => Promise<Result<Profile>>
  updateMyPreferences: (user: AuthenticatedUser, preferences: Preferences) => Promise<Preferences>
}

const profileSchema = z.object({
  displayName: z.string().max(100),
  avatarId: z.string().min(1).max(50),
})

const preferencesSchema = z.object({
  soundEnabled: z.boolean(),
  speechEngine: z.enum(SPEECH_ENGINES),
})

// Rutas del estudiante con sesión iniciada. Solo traducen HTTP: las reglas
// viven en los casos de uso.
export function meRoutes({ authVerifier, getMyAccount, updateMyProfile, updateMyPreferences, clock }: MeServices & { clock: Clock }) {
  return new Hono<AppEnv>()
    .use('/me', requireUser(authVerifier))
    .use('/me/*', requireUser(authVerifier))
    .get('/me', async (context) => {
      context.header('Cache-Control', 'no-store')
      return context.json(await getMyAccount(context.var.user, resolveClientDate(context, clock)))
    })
    .put('/me/profile', async (context) => {
      const body = await parseJsonBody(context, profileSchema)
      if (!body.ok) return body.response
      const result = await updateMyProfile(context.var.user, body.value)
      return result.ok ? context.json(result.value) : domainErrorResponse(context, result.error)
    })
    .put('/me/preferences', async (context) => {
      const body = await parseJsonBody(context, preferencesSchema)
      if (!body.ok) return body.response
      return context.json(await updateMyPreferences(context.var.user, body.value))
    })
}
