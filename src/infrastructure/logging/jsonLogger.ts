import type { LogLevel } from '../../config/config.js'
import type { LogContext, Logger } from '../../ports/logger.js'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

type Options = {
  level: LogLevel
  write?: (line: string) => void
  now?: () => Date
}

// Una línea JSON por evento: Render y cualquier visor de logs pueden filtrarla.
export function createJsonLogger({ level, write = (line) => process.stdout.write(`${line}\n`), now = () => new Date() }: Options): Logger {
  const log = (entryLevel: LogLevel) => (message: string, context: LogContext = {}) => {
    if (LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) return
    write(JSON.stringify({ time: now().toISOString(), level: entryLevel, message, ...context }))
  }
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') }
}
