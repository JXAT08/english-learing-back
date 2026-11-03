import { serve } from '@hono/node-server'
import { createContainer } from './composition/container.js'

const { app, config, logger } = createContainer(process.env)

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info('server_started', { port: info.port, environment: config.environment })
})

// Render envía SIGTERM al desplegar una versión nueva: se terminan las
// peticiones en curso antes de salir.
function shutdown(signal: string) {
  logger.info('server_stopping', { signal })
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
