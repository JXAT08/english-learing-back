import { fail, ok, type Result } from '../shared/result.js'

export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 30
export const DEFAULT_DISPLAY_NAME = 'Estudiante EnglishTech'
export const DEFAULT_AVATAR_ID = 'default-student'

export type Profile = {
  displayName: string
  avatarId: string
  createdAt: string
}

export function validateDisplayName(raw: string): Result<string> {
  const displayName = raw.trim()
  if (displayName.length < DISPLAY_NAME_MIN) return fail('validation_error', `Escribe un nombre de al menos ${DISPLAY_NAME_MIN} caracteres.`)
  if (displayName.length > DISPLAY_NAME_MAX) return fail('validation_error', `El nombre puede tener como máximo ${DISPLAY_NAME_MAX} caracteres.`)
  return ok(displayName)
}

// Al crear la cuenta se usa el nombre de Google; si no sirve, uno genérico.
export function initialDisplayName(nameFromProvider: string | undefined) {
  const trimmed = nameFromProvider?.trim().slice(0, DISPLAY_NAME_MAX).trim() ?? ''
  return trimmed.length >= DISPLAY_NAME_MIN ? trimmed : DEFAULT_DISPLAY_NAME
}
