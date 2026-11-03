import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../config/config.js'
import { testCatalog } from '../testing/inMemoryRepositories.js'
import { ANA_ID, ANA_TOKEN, createTestServices } from '../testing/testServices.js'
import { createApp } from './app.js'

const config: AppConfig = { environment: 'test', port: 3000, allowedOrigins: ['http://localhost:5173'], logLevel: 'error', supabaseUrl: 'https://test.supabase.co', supabaseSecretKey: 'sb_secret_test' }
const silentLogger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined }

function setup() {
  const services = createTestServices()
  const app = createApp({ config, logger: silentLogger, clock: { now: () => new Date('2026-11-03T15:00:00.000Z') }, services })
  const asAna = (path: string, init: RequestInit = {}) => app.request(path, {
    ...init,
    headers: { Authorization: `Bearer ${ANA_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  })
  return { app, services, asAna }
}

describe('catálogo', () => {
  it('se sirve sin sesión y con caché pública de 5 minutos', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/catalog')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(testCatalog)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
  })
})

describe('cuenta del estudiante', () => {
  it.each([
    ['sin token', {}],
    ['con un token inválido', { Authorization: 'Bearer falso' }],
    ['con otro esquema', { Authorization: `Basic ${ANA_TOKEN}` }],
  ])('rechaza /me %s', async (_case, headers) => {
    const { app } = setup()

    const response = await app.request('/api/v1/me', { headers })

    expect(response.status).toBe(401)
    expect((await response.json()).error).toMatchObject({ code: 'unauthorized', message: 'Inicia sesión para continuar.' })
  })

  it('devuelve la cuenta y la crea la primera vez', async () => {
    const { asAna, services } = setup()

    const response = await asAna('/api/v1/me')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.profile.displayName).toBe('Ana Lucía')
    expect(body.progress).toMatchObject({ totalXp: 0, level: 1 })
    expect(services.accounts.accounts.has(ANA_ID)).toBe(true)
  })

  it('usa la fecha del estudiante para saber si su racha sigue viva', async () => {
    const { asAna, services } = setup()
    await asAna('/api/v1/me')
    services.accounts.accounts.get(ANA_ID)!.progress = { totalXp: 50, currentStreak: 3, bestStreak: 3, lastPracticeDate: '2026-11-02' }

    const today = await (await asAna('/api/v1/me', { headers: { 'X-Client-Date': '2026-11-03' } })).json()
    const dayAfter = await (await asAna('/api/v1/me', { headers: { 'X-Client-Date': '2026-11-04' } })).json()

    expect(today.progress.currentStreak).toBe(3)
    expect(dayAfter.progress.currentStreak).toBe(0)
  })

  it('ignora una fecha del estudiante absurda y usa la del servidor', async () => {
    const { asAna, services } = setup()
    await asAna('/api/v1/me')
    services.accounts.accounts.get(ANA_ID)!.progress = { totalXp: 50, currentStreak: 3, bestStreak: 3, lastPracticeDate: '2026-11-02' }

    const body = await (await asAna('/api/v1/me', { headers: { 'X-Client-Date': '2030-01-01' } })).json()

    expect(body.progress.currentStreak).toBe(3)
  })
})

describe('perfil y preferencias', () => {
  it('guarda un perfil válido', async () => {
    const { asAna } = setup()

    const response = await asAna('/api/v1/me/profile', { method: 'PUT', body: JSON.stringify({ displayName: 'Ana', avatarId: 'robot' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ displayName: 'Ana', avatarId: 'robot' })
  })

  it.each([
    ['sin avatar', { displayName: 'Ana' }],
    ['con un nombre que no es texto', { displayName: 42, avatarId: 'robot' }],
    ['con un nombre demasiado corto', { displayName: 'A', avatarId: 'robot' }],
    ['con un avatar inexistente', { displayName: 'Ana', avatarId: 'dragon' }],
  ])('rechaza el perfil %s con 400', async (_case, body) => {
    const { asAna } = setup()

    const response = await asAna('/api/v1/me/profile', { method: 'PUT', body: JSON.stringify(body) })

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('validation_error')
  })

  it('rechaza JSON malformado con 400', async () => {
    const { asAna } = setup()

    const response = await asAna('/api/v1/me/profile', { method: 'PUT', body: '{nombre: ' })

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('validation_error')
  })

  it('guarda preferencias válidas y rechaza un motor de voz desconocido', async () => {
    const { asAna } = setup()

    const saved = await asAna('/api/v1/me/preferences', { method: 'PUT', body: JSON.stringify({ soundEnabled: false, speechEngine: 'local' }) })
    const invalid = await asAna('/api/v1/me/preferences', { method: 'PUT', body: JSON.stringify({ soundEnabled: false, speechEngine: 'magia' }) })

    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ soundEnabled: false, speechEngine: 'local' })
    expect(invalid.status).toBe(400)
  })

  it('exige sesión para cambiar el perfil', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/me/profile', { method: 'PUT', body: JSON.stringify({ displayName: 'Ana', avatarId: 'robot' }) })

    expect(response.status).toBe(401)
  })
})

describe('partidas y palabras estudiadas', () => {
  const game = {
    eventId: 'definition-1730000000000',
    activity: 'definition',
    answers: [
      { wordId: 'web-browser', correct: true, score: 100 },
      { wordId: 'web-component', correct: true, score: 100 },
      { wordId: 'web-deploy', correct: true, score: 100 },
    ],
  }
  const post = (asAna: ReturnType<typeof setup>['asAna'], path: string, body?: unknown) =>
    asAna(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers: { 'X-Client-Date': '2026-11-03' } })

  it('registra una partida y devuelve la recompensa con la cuenta actualizada', async () => {
    const { asAna } = setup()

    const response = await post(asAna, '/api/v1/me/activities', game)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reward).toEqual({ xpAwarded: 25, dailyLimitReached: false, newAchievements: ['first-step', 'first-game'], duplicate: false })
    expect(body.account.progress).toMatchObject({ totalXp: 25, currentStreak: 1, lastPracticeDate: '2026-11-03' })
    expect(body.account.studiedWordIds).toEqual(['web-browser', 'web-component', 'web-deploy'])
  })

  it('un reintento de la misma partida responde igual sin sumar otra vez', async () => {
    const { asAna } = setup()
    await post(asAna, '/api/v1/me/activities', game)

    const body = await (await post(asAna, '/api/v1/me/activities', game)).json()

    expect(body.reward.duplicate).toBe(true)
    expect(body.account.progress.totalXp).toBe(25)
  })

  it.each([
    ['sin respuestas', { ...game, answers: [] }],
    ['con más de 20 respuestas', { ...game, answers: Array.from({ length: 21 }, () => ({ correct: true })) }],
    ['con una puntuación mayor a 100', { ...game, answers: [{ correct: true, score: 150 }] }],
    ['con un eventId con caracteres raros', { ...game, eventId: 'hola mundo<script>' }],
    ['con una actividad desconocida', { ...game, activity: 'ajedrez' }],
  ])('rechaza una partida %s con 400', async (_case, body) => {
    const { asAna } = setup()

    const response = await post(asAna, '/api/v1/me/activities', body)

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('validation_error')
  })

  it('marca una palabra en Recursos con 10 XP', async () => {
    const { asAna } = setup()

    const body = await (await post(asAna, '/api/v1/me/words/web-link/study')).json()

    expect(body.reward.xpAwarded).toBe(10)
    expect(body.account.studiedWordIds).toEqual(['web-link'])
  })

  it('responde 404 al marcar una palabra que no existe', async () => {
    const { asAna } = setup()

    const response = await post(asAna, '/api/v1/me/words/inventada/study')

    expect(response.status).toBe(404)
  })

  it('exige sesión para registrar partidas', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/me/activities', { method: 'POST', body: JSON.stringify(game) })

    expect(response.status).toBe(401)
  })
})

describe('progreso de invitado y borrado de la cuenta', () => {
  const guest = {
    totalXp: 120,
    currentStreak: 2,
    bestStreak: 4,
    lastPracticeDate: '2026-11-02',
    studiedWordIds: ['web-browser', 'web-component'],
    unlockedAchievementIds: ['first-step'],
    avatarId: 'robot',
  }

  it('importa el progreso de invitado y devuelve la cuenta actualizada', async () => {
    const { asAna } = setup()

    const response = await asAna('/api/v1/me/import', { method: 'POST', body: JSON.stringify(guest), headers: { 'X-Client-Date': '2026-11-03' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result).toMatchObject({ imported: true, importedXp: 120, importedWords: 2 })
    expect(body.account.progress).toMatchObject({ totalXp: 120, currentStreak: 2 })
    expect(body.account.profile.avatarId).toBe('robot')
  })

  it.each([
    ['con XP negativa', { ...guest, totalXp: -5 }],
    ['con una fecha mal escrita', { ...guest, lastPracticeDate: '03/11/2026' }],
    ['con demasiadas palabras', { ...guest, studiedWordIds: Array.from({ length: 201 }, (_, index) => `w${index}`) }],
    ['sin los campos obligatorios', { totalXp: 10 }],
  ])('rechaza un progreso de invitado %s', async (_case, body) => {
    const { asAna } = setup()

    const response = await asAna('/api/v1/me/import', { method: 'POST', body: JSON.stringify(body) })

    expect(response.status).toBe(400)
  })

  it('no borra la cuenta sin confirmación explícita', async () => {
    const { asAna, services } = setup()

    const response = await asAna('/api/v1/me', { method: 'DELETE', body: JSON.stringify({}) })

    expect(response.status).toBe(400)
    expect(services.deletedAccounts).toEqual([])
  })

  it('borra la cuenta con confirmación y responde 204', async () => {
    const { asAna, services } = setup()
    await asAna('/api/v1/me')

    const response = await asAna('/api/v1/me', { method: 'DELETE', body: JSON.stringify({ confirm: true }) })

    expect(response.status).toBe(204)
    expect(services.deletedAccounts).toEqual([ANA_ID])
    expect(services.accounts.accounts.has(ANA_ID)).toBe(false)
  })

  it('exige sesión para borrar la cuenta', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/me', { method: 'DELETE', body: JSON.stringify({ confirm: true }) })

    expect(response.status).toBe(401)
  })
})
