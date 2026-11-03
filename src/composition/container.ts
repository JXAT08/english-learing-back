import { loadConfig } from '../config/config.js'
import { createApp } from '../http/app.js'
import { systemClock } from '../infrastructure/clock/systemClock.js'
import { createJsonLogger } from '../infrastructure/logging/jsonLogger.js'

// Raíz de composición: el único lugar que conoce las implementaciones reales
// (Supabase, OpenAI, reloj, logs). El resto del código depende de interfaces.
export function createContainer(env: Record<string, string | undefined>, logOutput: { write?: (line: string) => void } = {}) {
  const config = loadConfig(env)
  const logger = createJsonLogger({ level: config.logLevel, write: logOutput.write })
  const clock = systemClock
  const app = createApp({ config, logger, clock })
  return { config, logger, app }
}
