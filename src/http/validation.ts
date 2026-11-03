import type { Context } from 'hono'
import type { z } from 'zod'
import type { DomainError } from '../shared/result.js'
import { errorBody } from './errors.js'

type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response }

// Lee el cuerpo JSON y lo valida con Zod. Un cuerpo inválido nunca llega a los casos de uso.
export async function parseJsonBody<T>(context: Context, schema: z.ZodType<T>): Promise<Parsed<T>> {
  let body: unknown
  try {
    body = await context.req.json()
  } catch {
    return { ok: false, response: context.json(errorBody('validation_error', 'El cuerpo de la petición no es JSON válido.', context.get('requestId')), 400) }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.join('.') || 'cuerpo'
    return { ok: false, response: context.json(errorBody('validation_error', `Dato inválido en «${field}».`, context.get('requestId')), 400) }
  }
  return { ok: true, value: parsed.data }
}

const STATUS_BY_CODE = { validation_error: 400, not_found: 404 } as const

// Traduce un error del dominio a la respuesta HTTP con el formato común.
export function domainErrorResponse(context: Context, error: DomainError) {
  return context.json(errorBody(error.code, error.message, context.get('requestId')), STATUS_BY_CODE[error.code])
}
