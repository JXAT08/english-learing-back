// Contenido de EnglishTech. Vive en la base de datos y se sirve al frontend tal cual.

export type Word = {
  id: string
  term: string
  translation: string
  definition: string
  definitionEs: string
  example: string
  pronunciationPhrase: string
  pronunciationHint: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  synonyms: string[]
  antonyms: string[]
  keywords: string[]
}

export type Category = {
  id: string
  name: string
  description: string
  icon: 'code' | 'database' | 'shield'
  tone: 'violet' | 'blue' | 'green'
  words: Word[]
}

export type ConversationTurn = {
  id: string
  botMessage: string
  criteria: string[]
  alternatives: Record<string, string[]>
  suggestion: string
}

export type ConversationScenario = {
  id: string
  title: string
  description: string
  turns: ConversationTurn[]
}

export type Level = { level: number; name: string; minimumXp: number }

export type AchievementDefinition = { id: string; name: string; description: string }

export type Avatar = { id: string; label: string; tone: 'violet' | 'blue' | 'cyan' | 'green' | 'amber' | 'rose' }

export type ActivityRule = { activity: string; baseXp: number; dailyRewardLimit: number | null }

export type Catalog = {
  categories: Category[]
  conversationScenarios: ConversationScenario[]
  levels: Level[]
  achievements: AchievementDefinition[]
  avatars: Avatar[]
  dailyTips: string[]
  activityRules: ActivityRule[]
}
