import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthVerifier } from '../../ports/authVerifier.js'
import type { Logger } from '../../ports/logger.js'
import { userFromClaims } from './mappers.js'

// Verifica la firma del token con las claves públicas del proyecto (JWKS, que
// supabase-js guarda en caché), sin una llamada a Supabase por petición.
export function createSupabaseAuthVerifier(client: SupabaseClient, logger: Logger): AuthVerifier {
  return {
    async verify(accessToken) {
      const { data, error } = await client.auth.getClaims(accessToken)
      if (error || !data) {
        logger.debug('auth_rejected', { reason: error?.message ?? 'sin datos' })
        return null
      }
      return userFromClaims(data.claims)
    },
  }
}
