// Borra la cuenta de autenticación del estudiante. La base de datos elimina en
// cascada su perfil, progreso, palabras, insignias, partidas y preferencias.
export interface AccountDeleter {
  deleteAccount(userId: string): Promise<void>
}
