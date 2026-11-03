import { describe, expect, it } from 'vitest'
import { ConfigError } from '../config/config.js'
import { createContainer } from './container.js'

describe('ensamblado de la aplicación', () => {
  it('arma la API real lista para responder', async () => {
    const env = { PORT: '4000', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_valor-de-prueba-largo' }
    const { app, config } = createContainer(env, { write: () => undefined })

    const response = await app.request('/api/v1/health')

    expect(config.port).toBe(4000)
    expect(response.status).toBe(200)
  })

  it('no arranca con una configuración inválida', () => {
    expect(() => createContainer({ NODE_ENV: 'production' }, { write: () => undefined })).toThrow(ConfigError)
  })
})
