import { z } from 'zod'

export type Environment = 'development' | 'test' | 'production'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type AppConfig = {
  environment: Environment
  port: number
  allowedOrigins: string[]
  logLevel: LogLevel
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const DEVELOPMENT_ORIGIN = 'http://localhost:5173'

// Un origen es protocolo + dominio + puerto, sin ruta: así lo envía el navegador en CORS.
function isOrigin(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash
  } catch {
    return false
  }
}

const originList = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean))
  .refine((origins) => origins.length > 0 && origins.every(isOrigin), {
    message: 'debe ser una lista de orígenes separados por comas, como https://mi-app.vercel.app',
  })

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    ALLOWED_ORIGINS: originList.optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, context) => {
    // En producción no se adivina el frontend: un CORS abierto por error expondría la API.
    if (env.NODE_ENV === 'production' && !env.ALLOWED_ORIGINS) {
      context.addIssue({ code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'es obligatoria en producción' })
    }
  })

// Lee y valida las variables de entorno al arrancar. Si algo está mal, el
// servidor no arranca y el mensaje dice qué variable corregir.
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = environmentSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new ConfigError(`Configuración inválida. ${problems.join('; ')}`)
  }
  const { NODE_ENV, PORT, ALLOWED_ORIGINS, LOG_LEVEL } = parsed.data
  return {
    environment: NODE_ENV,
    port: PORT,
    allowedOrigins: ALLOWED_ORIGINS ?? [DEVELOPMENT_ORIGIN],
    logLevel: LOG_LEVEL,
  }
}
