import { describe, expect, it } from 'vitest'
import { createJsonLogger } from './jsonLogger.js'

describe('registro de logs en JSON', () => {
  function capture(level: 'debug' | 'info' | 'warn' | 'error') {
    const lines: string[] = []
    const logger = createJsonLogger({ level, write: (line) => lines.push(line), now: () => new Date('2026-11-03T10:00:00.000Z') })
    return { logger, lines }
  }

  it('escribe una línea JSON con fecha, nivel, mensaje y contexto', () => {
    const { logger, lines } = capture('info')

    logger.info('request', { path: '/api/v1/health', status: 200 })

    expect(JSON.parse(lines[0])).toEqual({
      time: '2026-11-03T10:00:00.000Z',
      level: 'info',
      message: 'request',
      path: '/api/v1/health',
      status: 200,
    })
  })

  it('descarta los mensajes por debajo del nivel configurado', () => {
    const { logger, lines } = capture('warn')

    logger.debug('detalle')
    logger.info('normal')
    logger.warn('aviso')
    logger.error('fallo')

    expect(lines.map((line) => JSON.parse(line).level)).toEqual(['warn', 'error'])
  })
})
