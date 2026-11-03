// Formato único de error de la API. El requestId permite buscar el caso en los
// logs sin mostrar detalles internos al estudiante.
export type ErrorBody = {
  error: {
    code: string
    message: string
    requestId: string
  }
}

export function errorBody(code: string, message: string, requestId: string): ErrorBody {
  return { error: { code, message, requestId } }
}
