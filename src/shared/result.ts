// Los errores esperados (datos inválidos, algo que no existe) se devuelven como
// valor en lugar de lanzarse: el compilador obliga a tratarlos.
export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E }

export type DomainErrorCode = 'validation_error' | 'not_found'

export type DomainError = {
  code: DomainErrorCode
  message: string
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

export const fail = (code: DomainErrorCode, message: string): Result<never> => ({ ok: false, error: { code, message } })
