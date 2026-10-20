import { describe, expect, it, vi } from 'vitest'
import { createOpenAITutor } from './tutor.js'

describe('adaptador autorizado de OpenAI', () => {
  it('envía solo texto autorizado y solicita no almacenar la respuesta', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        feedbackSpanish: 'Muy bien.',
        nextEnglish: 'The browser displays the website.',
        action: 'continue',
        level: 'excellent',
        recognizedWords: ['browser'],
        practiceWords: [],
      }),
    })
    const tutor = createOpenAITutor({ responses: { create } }, 'gpt-5.6-luna')

    await tutor.guide({ mode: 'word', targetEnglish: 'Browser', transcript: 'browser' })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5.6-luna',
      store: false,
      input: JSON.stringify({ mode: 'word', targetEnglish: 'Browser', transcript: 'browser' }),
    }))
    const transmittedInput = JSON.parse(create.mock.calls[0][0].input as string)
    expect(Object.keys(transmittedInput)).toEqual(['mode', 'targetEnglish', 'transcript'])
  })
})
