import { describe, expect, it } from 'vitest'
import type { AppConfig } from '../config/config.js'
import type { Logger, LogContext } from '../ports/logger.js'
import { createTestServices } from '../testing/testServices.js'
import { createApp } from './app.js'

type Entry = { level: string; message: string; context?: LogContext }

function recordingLogger() {
  const entries: Entry[] = []
  const write = (level: string) => (message: string, context?: LogContext) => { entries.push({ level, message, context }) }
  const logger: Logger = { debug: write('debug'), info: write('info'), warn: write('warn'), error: write('error') }
  return { logger, entries }
}

const config: AppConfig = { environment: 'test', port: 3000, allowedOrigins: ['http://localhost:5173'], logLevel: 'info', supabaseUrl: 'https://test.supabase.co', supabaseSecretKey: 'sb_secret_test' }
const clock = { now: () => new Date('2026-11-03T10:00:00.000Z') }

function setup() {
  const { logger, entries } = recordingLogger()
  return { app: createApp({ config, logger, clock, services: createTestServices() }), entries }
}

describe('API HTTP del backend', () => {
  it('responde la comprobación de salud con un ID de petición', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', time: '2026-11-03T10:00:00.000Z' })
    expect(response.headers.get('x-request-id')).toMatch(/.+/)
  })

  it('reutiliza el ID de petición que envía el cliente', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/health', { headers: { 'X-Request-Id': 'frontend-123' } })

    expect(response.headers.get('x-request-id')).toBe('frontend-123')
  })

  it('responde 404 en JSON con el formato común de errores', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/no-existe')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'La ruta solicitada no existe.', requestId: response.headers.get('x-request-id') },
    })
  })

  it('oculta los detalles de un error inesperado y lo registra en el log', async () => {
    const { app, entries } = setup()
    app.get('/api/v1/falla', () => { throw new Error('detalle interno secreto') })

    const response = await app.request('/api/v1/falla')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('internal_error')
    expect(JSON.stringify(body)).not.toContain('detalle interno secreto')
    expect(entries).toContainEqual(expect.objectContaining({
      level: 'error',
      message: 'unhandled_error',
      context: expect.objectContaining({ error: 'detalle interno secreto', requestId: body.error.requestId }),
    }))
  })

  it('permite CORS solo a los orígenes configurados', async () => {
    const { app } = setup()

    const allowed = await app.request('/api/v1/health', { headers: { Origin: 'http://localhost:5173' } })
    const blocked = await app.request('/api/v1/health', { headers: { Origin: 'https://sitio-ajeno.example' } })

    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('responde el preflight con los métodos y cabeceras que usará el frontend', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
  })

  it('añade cabeceras de seguridad', async () => {
    const { app } = setup()

    const response = await app.request('/api/v1/health')

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('registra cada petición sin la cadena de consulta', async () => {
    const { app, entries } = setup()

    await app.request('/api/v1/health?token=privado')

    expect(entries).toContainEqual(expect.objectContaining({
      level: 'info',
      message: 'request',
      context: expect.objectContaining({ method: 'GET', path: '/api/v1/health', status: 200 }),
    }))
    expect(JSON.stringify(entries)).not.toContain('privado')
  })
})
