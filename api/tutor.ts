export type TutorRequest = {
  mode: 'word' | 'chunk' | 'sentence'
  targetEnglish: string
  transcript: string
}

export type TutorGuidance = {
  feedbackSpanish: string
  nextEnglish: string
  action: 'repeat' | 'easier' | 'continue'
  level: 'practice' | 'good' | 'excellent'
  recognizedWords: string[]
  practiceWords: string[]
}

export type TutorModel = { guide(input: TutorRequest): Promise<TutorGuidance> }
type ResponsesClient = { responses: { create(input: Record<string, unknown>): Promise<{ output_text: string }> } }
type RequestLike = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type ResponseLike = { status(code: number): ResponseLike; json(value: unknown): ResponseLike; setHeader(name: string, value: string): ResponseLike; end(): ResponseLike }

function parseTutorRequest(body: unknown): TutorRequest | null {
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  if (!['word', 'chunk', 'sentence'].includes(String(value.mode))) return null
  if (typeof value.targetEnglish !== 'string' || value.targetEnglish.trim().length < 1 || value.targetEnglish.length > 300) return null
  if (typeof value.transcript !== 'string' || value.transcript.trim().length < 1 || value.transcript.length > 1000) return null
  return {
    mode: value.mode as TutorRequest['mode'],
    targetEnglish: value.targetEnglish.trim(),
    transcript: value.transcript.trim(),
  }
}

export function createTutorHandler(model: TutorModel, options: { allowedOrigin: string }) {
  return async (request: RequestLike, response: ResponseLike) => {
    response.setHeader('Access-Control-Allow-Origin', options.allowedOrigin)
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (request.method === 'OPTIONS') return response.status(204).end()
    if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' })
    const input = parseTutorRequest(request.body)
    if (!input) return response.status(400).json({ error: 'invalid_request', message: 'La frase y la transcripción son obligatorias.' })
    try {
      const guidance = await model.guide(input)
      return response.status(200).json(guidance)
    } catch {
      return response.status(502).json({ error: 'tutor_unavailable', message: 'El tutor no está disponible. Inténtalo nuevamente.' })
    }
  }
}

const guidanceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    feedbackSpanish: { type: 'string' },
    nextEnglish: { type: 'string' },
    action: { type: 'string', enum: ['repeat', 'easier', 'continue'] },
    level: { type: 'string', enum: ['practice', 'good', 'excellent'] },
    recognizedWords: { type: 'array', items: { type: 'string' } },
    practiceWords: { type: 'array', items: { type: 'string' } },
  },
  required: ['feedbackSpanish', 'nextEnglish', 'action', 'level', 'recognizedWords', 'practiceWords'],
}

export function createOpenAITutor(client: ResponsesClient, model: string): TutorModel {
  return {
    async guide(input) {
      const result = await client.responses.create({
        model,
        store: false,
        max_output_tokens: 300,
        instructions: [
          'Eres un tutor amable de pronunciación de inglés técnico para principiantes.',
          'Explica brevemente en español y entrega el objetivo de práctica en inglés.',
          'Solo recibes una transcripción: nunca afirmes haber analizado fonemas, acento o audio.',
          'Tolera artículos omitidos y pequeñas diferencias si se conserva la idea principal.',
          'Permite repetir sin penalización y recomienda una palabra o fragmento si hay dificultad.',
        ].join(' '),
        input: JSON.stringify(input),
        text: { format: { type: 'json_schema', name: 'tutor_guidance', strict: true, schema: guidanceSchema } },
      })
      return JSON.parse(result.output_text) as TutorGuidance
    },
  }
}

const productionTutor: TutorModel = {
  async guide(input) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return createOpenAITutor(client as unknown as ResponsesClient, process.env.OPENAI_MODEL ?? 'gpt-5.6-luna').guide(input)
  },
}

export const config = { maxDuration: 15 }
export default createTutorHandler(productionTutor, {
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
}) as (request: VercelRequest, response: VercelResponse) => Promise<unknown>
import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
