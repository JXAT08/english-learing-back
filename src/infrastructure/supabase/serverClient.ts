import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente con la clave secreta: salta la seguridad por fila, así que cada
// consulta del backend filtra siempre por el id del estudiante verificado.
export function createServerSupabaseClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
