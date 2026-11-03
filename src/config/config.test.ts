import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from './config.js'

// Variables obligatorias en todos los entornos.
const SUPABASE = { SUPABASE_URL: 'https://jerpgjfclvuzwxsdcyzi.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_valor-de-prueba-largo' }

describe('configuración del servidor', () => {
  it('usa valores seguros por defecto en desarrollo', () => {
    const config = loadConfig(SUPABASE)

    expect(config).toEqual({
      environment: 'development',
      port: 3000,
      allowedOrigins: ['http://localhost:5173'],
      logLevel: 'info',
      supabaseUrl: 'https://jerpgjfclvuzwxsdcyzi.supabase.co',
      supabaseSecretKey: 'sb_secret_valor-de-prueba-largo',
    })
  })

  it('lee el puerto y una lista de orígenes separada por comas', () => {
    const config = loadConfig({
      ...SUPABASE,
      NODE_ENV: 'production',
      PORT: '10000',
      ALLOWED_ORIGINS: 'https://english-learing-web-eight.vercel.app, http://localhost:5173',
    })

    expect(config.environment).toBe('production')
    expect(config.port).toBe(10000)
    expect(config.allowedOrigins).toEqual(['https://english-learing-web-eight.vercel.app', 'http://localhost:5173'])
  })

  it('en producción exige declarar los orígenes permitidos', () => {
    expect(() => loadConfig({ ...SUPABASE, NODE_ENV: 'production' })).toThrow(ConfigError)
    expect(() => loadConfig({ ...SUPABASE, NODE_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/)
  })

  it.each([
    ['un puerto que no es número', { PORT: 'abc' }, /PORT/],
    ['un origen que no es URL', { ALLOWED_ORIGINS: 'no-es-url' }, /ALLOWED_ORIGINS/],
    ['un origen con ruta', { ALLOWED_ORIGINS: 'https://app.example.com/inicio' }, /ALLOWED_ORIGINS/],
    ['un nivel de log desconocido', { LOG_LEVEL: 'ruido' }, /LOG_LEVEL/],
    ['una URL de Supabase inválida', { SUPABASE_URL: 'no-es-url' }, /SUPABASE_URL/],
  ])('rechaza %s con un mensaje que nombra la variable', (_case, env, message) => {
    expect(() => loadConfig({ ...SUPABASE, ...env })).toThrow(message)
  })

  it('exige la clave secreta de Supabase', () => {
    expect(() => loadConfig({ SUPABASE_URL: SUPABASE.SUPABASE_URL })).toThrow(/SUPABASE_SECRET_KEY/)
  })

  it('rechaza la clave pública puesta por error en lugar de la secreta', () => {
    expect(() => loadConfig({ ...SUPABASE, SUPABASE_SECRET_KEY: 'sb_publishable_1UZYGL3Crxg1kVI4-rnH1w' })).toThrow(/no la pública/)
  })
})
