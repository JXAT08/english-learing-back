export type LogContext = Record<string, unknown>

// Puerto de registro: los casos de uso y el HTTP no dependen de cómo se escriben los logs.
export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
}
