import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from './config.js'

describe('configuración del servidor', () => {
  it('usa valores seguros por defecto en desarrollo', () => {
    const config = loadConfig({})

    expect(config).toEqual({
      environment: 'development',
      port: 3000,
      allowedOrigins: ['http://localhost:5173'],
      logLevel: 'info',
    })
  })

  it('lee el puerto y una lista de orígenes separada por comas', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '10000',
      ALLOWED_ORIGINS: 'https://english-learing-web-eight.vercel.app, http://localhost:5173',
    })

    expect(config.environment).toBe('production')
    expect(config.port).toBe(10000)
    expect(config.allowedOrigins).toEqual(['https://english-learing-web-eight.vercel.app', 'http://localhost:5173'])
  })

  it('en producción exige declarar los orígenes permitidos', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError)
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/)
  })

  it.each([
    ['un puerto que no es número', { PORT: 'abc' }, /PORT/],
    ['un origen que no es URL', { ALLOWED_ORIGINS: 'no-es-url' }, /ALLOWED_ORIGINS/],
    ['un origen con ruta', { ALLOWED_ORIGINS: 'https://app.example.com/inicio' }, /ALLOWED_ORIGINS/],
    ['un nivel de log desconocido', { LOG_LEVEL: 'ruido' }, /LOG_LEVEL/],
  ])('rechaza %s con un mensaje que nombra la variable', (_case, env, message) => {
    expect(() => loadConfig(env)).toThrow(message)
  })
})
