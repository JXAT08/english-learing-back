import type { Preferences } from '../domain/preferences.js'
import type { Profile } from '../domain/profile.js'
import type { StudentProgress } from '../domain/progress.js'

export type { StudentProgress }

export type UnlockedAchievement = { id: string; unlockedAt: string }

// Todo lo guardado de un estudiante. Lo identifica el id de su cuenta de Supabase.
export type StudentAccount = {
  profile: Profile
  progress: StudentProgress
  preferences: Preferences
  studiedWordIds: string[]
  achievements: UnlockedAchievement[]
}

export type ProfileChanges = { displayName: string; avatarId: string }

export interface StudentAccountRepository {
  findAccount(userId: string): Promise<StudentAccount | null>
  // Crea perfil, progreso en cero y preferencias por defecto. Si ya existen, no los cambia.
  createAccount(userId: string, profile: ProfileChanges): Promise<StudentAccount>
  updateProfile(userId: string, changes: ProfileChanges): Promise<Profile>
  updatePreferences(userId: string, preferences: Preferences): Promise<Preferences>
}
