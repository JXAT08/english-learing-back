// Puerto de tiempo: las reglas de racha y el tope diario dependen de la fecha,
// así que las pruebas fijan el reloj en lugar de usar la hora real.
export interface Clock {
  now(): Date
}
