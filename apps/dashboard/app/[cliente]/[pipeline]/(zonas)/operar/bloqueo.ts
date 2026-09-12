// ponytail: BLOQUEO TEMPORAL del ▶ del motor (2026-09-12, pedido de Mani).
//
// El motor está en refactor (recencia por referente, normalización por edad, viralidad
// relativa) y una corrida hoy paga Apify para entregar casi nada: medido el 10/09, de ~1.828
// videos colectados sobreviven 14, y `min_views` global mata el 83 %.
//
// Vive acá y no inline en los dos consumidores para que desbloquear sea UNA línea y no una
// cacería. Techo: es un flag de código, no un ajuste — se apaga con deploy, no desde el
// cockpit. Upgrade: borrar este archivo y sus dos usos cuando el refactor esté en el live.
//
// El tipo va anotado a propósito: con `= true` a secas TypeScript infiere el literal `true`,
// da por inalcanzable todo lo que sigue al `return` y deja de estrechar tipos ahí abajo.
export const MOTOR_BLOQUEADO: boolean = true;

export const MOTOR_BLOQUEADO_MENSAJE =
  "🚧 El motor está bajo construcción: un dev lo está arreglando y las corridas quedaron pausadas. Te avisamos cuando vuelva.";
