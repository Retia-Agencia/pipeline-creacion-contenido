// Dominio puro (C4, ADR-103 D7): ¿esta voz ya corrió hoy? y qué dice el aviso.
// Aviso y no bloqueo: una segunda corrida el mismo día puede ser legítima (p. ej. tras recargar
// Anthropic, ADR-103 D6), así que el ▶ informa y deja decidir.

import { haceCuanto, type Corrida } from "./corrida.ts";

// El día calendario del equipo es el de Bogotá; el mismo huso que usa la pantalla de Operar.
const ZONA = "America/Bogota";
const diaDe = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA });

/**
 * La corrida más reciente de hoy que ya compró y entregó (`ok` o `parcial`).
 * `fallo` no cuenta: D6 retiene los videos cuando el gate falla entero, así que reintentar sí trae
 * algo. `en_curso` tampoco: ya lo frena `hayCorridaViva`.
 */
export function corridaDeHoy(corridas: Corrida[], ahora: Date): Corrida | null {
  const hoy = diaDe(ahora);
  const deHoy = corridas
    .filter((c) => (c.estado === "ok" || c.estado === "parcial") && diaDe(new Date(c.inicio)) === hoy)
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
  return deHoy[0] ?? null;
}

const usd = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `costoUsd` es el estimado de la misma confirmación; `null` si no se pudo calcular (no se inventa). */
export function avisoCorridaRepetida(inicioIso: string, costoUsd: number | null, ahora: Date): string {
  const cuando = haceCuanto(inicioIso, ahora);
  return costoUsd === null
    ? `Esta voz ya corrió hoy (${cuando}): lo más probable es que no traiga nada nuevo y cuesta igual.`
    : `Esta voz ya corrió hoy (${cuando}): no va a traer nada nuevo y cuesta ~${usd(costoUsd)} USD.`;
}
