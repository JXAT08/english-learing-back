import type { StudentProgress } from '../domain/progress.js'

// Lo que hace falta leer para aplicar las reglas a una práctica.
export type PracticeSnapshot = {
  progress: StudentProgress
  // Versión del progreso al leerlo; la escritura falla si cambió entretanto.
  version: number
  studiedWordIds: string[]
  achievementIds: string[]
  // Partidas de la actividad en el día del estudiante (para el tope diario).
  sessionsToday: number
}

export type StudySource = 'resources' | 'practice'

export type PracticeAnswer = { wordId?: string; turnId?: string; correct: boolean; score?: number }

export type PracticeWrite = {
  expectedVersion: number
  progress: StudentProgress
  session: {
    eventId: string
    activity: string
    score: number
    xpAwarded: number
    correctCount: number
    totalCount: number
    practicedOn: string
  } | null
  answers: PracticeAnswer[]
  words: { wordId: string; source: StudySource }[]
  achievements: string[]
}

// applied: guardado. duplicate: esa partida ya existía, no se cambió nada.
// conflict: el progreso cambió mientras se calculaba; hay que volver a calcular.
export type PracticeWriteResult = 'applied' | 'duplicate' | 'conflict'

export interface PracticeRepository {
  loadSnapshot(userId: string, activity: string | null, practicedOn: string): Promise<PracticeSnapshot>
  findSessionXp(userId: string, eventId: string): Promise<number | null>
  apply(userId: string, write: PracticeWrite): Promise<PracticeWriteResult>
}
