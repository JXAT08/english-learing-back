export type AuthenticatedUser = {
  id: string
  email: string | null
  // Nombre que trae la cuenta de Google, si lo hay.
  name: string | undefined
}

// Puerto de autenticación: comprueba el token de sesión que envía el frontend.
// Devuelve null si el token no es válido o caducó.
export interface AuthVerifier {
  verify(accessToken: string): Promise<AuthenticatedUser | null>
}
