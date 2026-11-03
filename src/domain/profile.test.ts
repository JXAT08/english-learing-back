import { describe, expect, it } from 'vitest'
import { initialDisplayName, validateDisplayName } from './profile.js'

describe('nombre visible del estudiante', () => {
  it('acepta un nombre válido sin espacios sobrantes', () => {
    expect(validateDisplayName('  Ana López  ')).toEqual({ ok: true, value: 'Ana López' })
  })

  it.each([
    ['muy corto', 'A', /al menos 2/],
    ['vacío', '   ', /al menos 2/],
    ['muy largo', 'a'.repeat(31), /como máximo 30/],
  ])('rechaza un nombre %s', (_case, name, message) => {
    const result = validateDisplayName(name)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.message).toMatch(message)
  })

  it('usa el nombre de la cuenta de Google al crear el perfil', () => {
    expect(initialDisplayName('Ana Lucía Pérez')).toBe('Ana Lucía Pérez')
  })

  it('recorta un nombre de Google demasiado largo', () => {
    expect(initialDisplayName('Nombre Muy Largo De Una Cuenta De Google')).toHaveLength(30)
  })

  it('usa un nombre genérico si Google no da uno válido', () => {
    expect(initialDisplayName(undefined)).toBe('Estudiante EnglishTech')
    expect(initialDisplayName(' ')).toBe('Estudiante EnglishTech')
  })
})
