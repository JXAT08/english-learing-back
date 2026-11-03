import { describe, expect, it } from 'vitest'
import { mapCatalogRows, userFromClaims } from './mappers.js'

describe('conversión de filas de Supabase al formato de la API', () => {
  it('arma el catálogo con nombres en camelCase, palabras en su categoría y en orden', () => {
    const catalog = mapCatalogRows({
      categories: [
        { id: 'data', name: 'Datos', description: 'D', icon: 'database', tone: 'blue', position: 2 },
        { id: 'web', name: 'Web', description: 'W', icon: 'code', tone: 'violet', position: 1 },
      ],
      words: [
        { id: 'w2', category_id: 'web', term: 'Link', translation: 'Enlace', definition: 'd', definition_es: 'de', example: 'e', pronunciation_phrase: 'p', pronunciation_hint: null, difficulty: 'beginner', synonyms: ['hyperlink'], antonyms: [], keywords: ['k'], position: 2 },
        { id: 'w1', category_id: 'web', term: 'Browser', translation: 'Navegador', definition: 'd', definition_es: 'de', example: 'e', pronunciation_phrase: 'p', pronunciation_hint: 'brau-ser', difficulty: 'beginner', synonyms: [], antonyms: [], keywords: ['k'], position: 1 },
      ],
      conversation_scenarios: [{ id: 's1', title: 'Stand-up', description: 'd', position: 1 }],
      conversation_turns: [
        { id: 't2', scenario_id: 's1', position: 2, bot_message: 'B2', criteria: ['help'], alternatives: {}, suggestion: 's' },
        { id: 't1', scenario_id: 's1', position: 1, bot_message: 'B1', criteria: ['task'], alternatives: { task: ['ticket'] }, suggestion: 's' },
      ],
      levels: [{ level: 2, name: 'Aprendiz', minimum_xp: 100 }, { level: 1, name: 'Principiante', minimum_xp: 0 }],
      achievement_definitions: [{ id: 'first-step', name: 'Primer paso', description: 'd', position: 1 }],
      avatars: [{ id: 'robot', label: 'Robot', tone: 'rose', position: 1 }],
      daily_tips: [{ id: 2, text: 'Segundo' }, { id: 1, text: 'Primero' }],
      activity_rules: [{ activity: 'definition', base_xp: 25, daily_reward_limit: 3 }],
    })

    expect(catalog.categories.map((category) => category.id)).toEqual(['web', 'data'])
    expect(catalog.categories[0].words.map((word) => word.term)).toEqual(['Browser', 'Link'])
    expect(catalog.categories[0].words[0]).toMatchObject({ definitionEs: 'de', pronunciationPhrase: 'p', pronunciationHint: 'brau-ser' })
    expect(catalog.categories[1].words).toEqual([])
    expect(catalog.conversationScenarios[0].turns.map((turn) => turn.botMessage)).toEqual(['B1', 'B2'])
    expect(catalog.conversationScenarios[0].turns[0].alternatives).toEqual({ task: ['ticket'] })
    expect(catalog.levels).toEqual([{ level: 1, name: 'Principiante', minimumXp: 0 }, { level: 2, name: 'Aprendiz', minimumXp: 100 }])
    expect(catalog.dailyTips).toEqual(['Primero', 'Segundo'])
    expect(catalog.activityRules).toEqual([{ activity: 'definition', baseXp: 25, dailyRewardLimit: 3 }])
  })
})

describe('estudiante a partir del token de Supabase', () => {
  it('toma el id, el correo y el nombre de la cuenta de Google', () => {
    expect(userFromClaims({
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'authenticated',
      email: 'ana@example.com',
      user_metadata: { full_name: 'Ana Lucía', name: 'Ana' },
    })).toEqual({ id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', name: 'Ana Lucía' })
  })

  it.each([
    ['la clave pública (rol anon, sin usuario)', { role: 'anon' }],
    ['un token sin usuario', { role: 'authenticated' }],
    ['un token de servicio', { sub: '11111111-1111-4111-8111-111111111111', role: 'service_role' }],
  ])('rechaza %s', (_case, claims) => {
    expect(userFromClaims(claims)).toBeNull()
  })
})
