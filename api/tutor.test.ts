import { describe, expect, it, vi } from 'vitest'
import { createTutorHandler, type TutorModel } from './tutor.js'

function responseRecorder() {
  let statusCode = 200
  let payload: unknown
  const headers = new Map<string, string>()
  return {
    response: {
      status(code: number) { statusCode = code; return this },
      json(value: unknown) { payload = value; return this },
      setHeader(name: string, value: string) { headers.set(name, value); return this },
      end() { return this },
    },
    result: () => ({ statusCode, payload, headers }),
  }
}

describe('POST /api/tutor', () => {
  it('devuelve orientación en español y el siguiente objetivo en inglés', async () => {
    const model: TutorModel = {
      guide: vi.fn().mockResolvedValue({
        feedbackSpanish: 'Muy bien. Se reconoció la palabra técnica principal.',
        nextEnglish: 'The browser displays the website.',
        action: 'continue',
        level: 'excellent',
        recognizedWords: ['browser'],
        practiceWords: [],
      }),
    }
    const recorder = responseRecorder()
    const handler = createTutorHandler(model, { allowedOrigin: 'http://localhost:5173' })

    await handler({
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
      body: { mode: 'word', targetEnglish: 'Browser', transcript: 'browser' },
    }, recorder.response)

    expect(recorder.result()).toMatchObject({
      statusCode: 200,
      payload: {
        feedbackSpanish: expect.stringContaining('Muy bien'),
        nextEnglish: 'The browser displays the website.',
        action: 'continue',
        level: 'excellent',
      },
    })
  })

  it('rechaza una solicitud sin transcripción antes de consultar el modelo', async () => {
    const model: TutorModel = { guide: vi.fn() }
    const recorder = responseRecorder()
    const handler = createTutorHandler(model, { allowedOrigin: 'http://localhost:5173' })

    await handler({
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
      body: { mode: 'word', targetEnglish: 'Browser', transcript: '' },
    }, recorder.response)

    expect(recorder.result()).toMatchObject({
      statusCode: 400,
      payload: { error: 'invalid_request' },
    })
    expect(model.guide).not.toHaveBeenCalled()
  })

  it('rechaza métodos distintos de POST', async () => {
    const model: TutorModel = { guide: vi.fn() }
    const recorder = responseRecorder()
    const handler = createTutorHandler(model, { allowedOrigin: 'http://localhost:5173' })

    await handler({ method: 'GET', headers: {}, body: undefined }, recorder.response)

    expect(recorder.result().statusCode).toBe(405)
    expect(model.guide).not.toHaveBeenCalled()
  })

  it('oculta errores del proveedor y devuelve una respuesta recuperable', async () => {
    const model: TutorModel = { guide: vi.fn().mockRejectedValue(new Error('secret provider detail')) }
    const recorder = responseRecorder()
    const handler = createTutorHandler(model, { allowedOrigin: 'http://localhost:5173' })

    await handler({
      method: 'POST',
      headers: {},
      body: { mode: 'word', targetEnglish: 'Browser', transcript: 'browser' },
    }, recorder.response)

    expect(recorder.result()).toMatchObject({
      statusCode: 502,
      payload: { error: 'tutor_unavailable' },
    })
    expect(JSON.stringify(recorder.result().payload)).not.toContain('secret provider detail')
  })
})
