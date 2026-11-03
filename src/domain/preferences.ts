export const SPEECH_ENGINES = ['auto', 'browser', 'local'] as const

export type SpeechEngine = (typeof SPEECH_ENGINES)[number]

export type Preferences = {
  soundEnabled: boolean
  // auto: el frontend elige; browser: servicio del navegador; local: Whisper.
  speechEngine: SpeechEngine
}

export const DEFAULT_PREFERENCES: Preferences = { soundEnabled: true, speechEngine: 'auto' }
