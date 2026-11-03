import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountDeleter } from '../../ports/accountDeleter.js'

// Borra el usuario de Supabase Auth (requiere la clave secreta). Las tablas
// del estudiante dependen de auth.users con on delete cascade, así que todos
// sus datos desaparecen en la misma operación.
export function createSupabaseAccountDeleter(client: SupabaseClient): AccountDeleter {
  return {
    async deleteAccount(userId) {
      const { error } = await client.auth.admin.deleteUser(userId)
      // Si ya no existe, el resultado es el mismo que se pedía: no es un error.
      if (error && error.status !== 404) throw new Error(`Borrar cuenta: ${error.message}`)
    },
  }
}
