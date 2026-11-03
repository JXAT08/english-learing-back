import type { ActivityRule, Avatar, Catalog, Category, ConversationScenario, Word } from '../../domain/catalog.js'
import type { AuthenticatedUser } from '../../ports/authVerifier.js'

// Filas tal como las devuelve Supabase (snake_case).
export type CatalogRows = {
  categories: { id: string; name: string; description: string; icon: Category['icon']; tone: Category['tone']; position: number }[]
  words: {
    id: string; category_id: string; term: string; translation: string; definition: string; definition_es: string; example: string
    pronunciation_phrase: string; pronunciation_hint: string | null; difficulty: Word['difficulty']; synonyms: string[]; antonyms: string[]
    keywords: string[]; position: number
  }[]
  conversation_scenarios: { id: string; title: string; description: string; position: number }[]
  conversation_turns: { id: string; scenario_id: string; position: number; bot_message: string; criteria: string[]; alternatives: Record<string, string[]>; suggestion: string }[]
  levels: { level: number; name: string; minimum_xp: number }[]
  achievement_definitions: { id: string; name: string; description: string; position: number }[]
  avatars: { id: string; label: string; tone: Avatar['tone']; position: number }[]
  daily_tips: { id: number; text: string }[]
  activity_rules: { activity: string; base_xp: number; daily_reward_limit: number | null }[]
}

const byPosition = <T extends { position: number }>(rows: T[]) => [...rows].sort((first, second) => first.position - second.position)

export function mapCatalogRows(rows: CatalogRows): Catalog {
  const categories: Category[] = byPosition(rows.categories).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    icon: category.icon,
    tone: category.tone,
    words: byPosition(rows.words.filter((word) => word.category_id === category.id)).map((word) => ({
      id: word.id,
      term: word.term,
      translation: word.translation,
      definition: word.definition,
      definitionEs: word.definition_es,
      example: word.example,
      pronunciationPhrase: word.pronunciation_phrase,
      pronunciationHint: word.pronunciation_hint,
      difficulty: word.difficulty,
      synonyms: word.synonyms,
      antonyms: word.antonyms,
      keywords: word.keywords,
    })),
  }))
  const conversationScenarios: ConversationScenario[] = byPosition(rows.conversation_scenarios).map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    turns: byPosition(rows.conversation_turns.filter((turn) => turn.scenario_id === scenario.id)).map((turn) => ({
      id: turn.id,
      botMessage: turn.bot_message,
      criteria: turn.criteria,
      alternatives: turn.alternatives,
      suggestion: turn.suggestion,
    })),
  }))
  const activityRules: ActivityRule[] = rows.activity_rules.map((rule) => ({
    activity: rule.activity,
    baseXp: rule.base_xp,
    dailyRewardLimit: rule.daily_reward_limit,
  }))
  return {
    categories,
    conversationScenarios,
    levels: [...rows.levels].sort((first, second) => first.minimum_xp - second.minimum_xp)
      .map((level) => ({ level: level.level, name: level.name, minimumXp: level.minimum_xp })),
    achievements: byPosition(rows.achievement_definitions).map(({ id, name, description }) => ({ id, name, description })),
    avatars: byPosition(rows.avatars).map(({ id, label, tone }) => ({ id, label, tone })),
    dailyTips: [...rows.daily_tips].sort((first, second) => first.id - second.id).map((tip) => tip.text),
    activityRules,
  }
}

type Claims = {
  sub?: string
  role?: string
  email?: string
  user_metadata?: { full_name?: string; name?: string }
}

// Solo un token de un estudiante con sesión (rol authenticated y con id) es válido.
export function userFromClaims(claims: Claims): AuthenticatedUser | null {
  if (claims.role !== 'authenticated' || !claims.sub) return null
  return {
    id: claims.sub,
    email: claims.email ?? null,
    name: claims.user_metadata?.full_name ?? claims.user_metadata?.name,
  }
}
