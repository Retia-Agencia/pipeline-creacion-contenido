// El corte de Supadata (ADR-095). Dominio puro: sin IO, sin React, sin `@/`.
//
// ⚠️ ESTE ARCHIVO VIVE DOS VECES. La copia de n8n está en el nodo `Transcribir (Supadata)` de
// Workflows/workflow-short-form-content/workflow.json, porque un Code node no puede importar del
// repo. Lo que las mantiene juntas NO es este comentario: es `test-nodos.mjs`, que importa
// `CASOS_COBERTURA` de acá y la corre contra la copia. Si divergen, ese test falla.

export type Segmento = { text: string; offset: number; duration: number };
export type Veredicto = "completo" | "parcial" | "desconocido";

/** Idéntico carácter por carácter a lo que Supadata devuelve con `text=true` (verificado 09/09). */
export function textoDeSegmentos(segs: readonly Segmento[]): string {
  return segs.map((s) => String(s?.text ?? "")).join(" ");
}

/** Hasta qué segundo llega el transcript. `null` = no se puede saber, que NO es cero. */
export function coberturaDeSegmentos(segs: readonly Segmento[]): number | null {
  if (!Array.isArray(segs) || segs.length === 0) return null;
  const u = segs[segs.length - 1];
  const fin = Number(u?.offset ?? 0) + Number(u?.duration ?? 0);
  return Number.isFinite(fin) ? Math.round(fin / 100) / 10 : null;
}

/**
 * 🔑 `desconocido` no es un empate cómodo: es el estado normal de un video de la pantalla de Majo
 * antes de que su colección compre la duración. El veredicto llega después, sin re-pagar nada.
 */
export function veredictoCobertura(
  cobertura: number | null, duracion: number | null, umbral: number,
): Veredicto {
  if (cobertura == null || duracion == null || !(duracion > 0)) return "desconocido";
  return cobertura >= duracion * umbral ? "completo" : "parcial";
}

/**
 * El umbral de producto: 0.9, medido sobre 583 transcripts cacheados (ADR-095) — 561 cubren más
 * del 90% de su video y el histograma no marca un quiebre entre 0.8 y 0.9 (10 filas en el medio,
 * 12 abajo de 0.8). Vive acá, al lado de la función que lo consume; el nodo del motor lo declara
 * en su propia copia textual (`Transcribir (Supadata)`), así que cambiarlo pide tocar los dos
 * lugares — no solo este archivo.
 */
export const UMBRAL_COBERTURA = 0.9;

/**
 * Lo que Majo lee al lado del guion. `null` cuando no hay nada que avisar: un `"completo"` está
 * sano, y un `"desconocido"` es el estado normal de un video sin duración todavía — avisar ahí
 * asustaría por un video que probablemente está perfecto.
 */
export function avisoDeCobertura(
  veredicto: Veredicto, cobertura: number | null, duracion: number | null,
): string | null {
  if (veredicto !== "parcial") return null;
  return `Guion incompleto: cubre ${Math.round(cobertura ?? 0)} s de ${Math.round(duracion ?? 0)} s`;
}

/** La tabla que corren las DOS implementaciones. Los tres primeros son videos reales. */
export const CASOS_COBERTURA = [
  { nombre: "DaTf9Wqxt8p — video callado, sano", cobertura: 53.2, duracion: 54.0, umbral: 0.8, espera: "completo" },
  { nombre: "Day8CXdBLwK — cortado, irrecuperable", cobertura: 29.0, duracion: 45.8, umbral: 0.8, espera: "parcial" },
  { nombre: "Db9Y_EGulGk — cortado, generate lo salva", cobertura: 41.5, duracion: 150.4, umbral: 0.8, espera: "parcial" },
  { nombre: "sin duración", cobertura: 29.0, duracion: null, umbral: 0.8, espera: "desconocido" },
  { nombre: "sin cobertura", cobertura: null, duracion: 45.8, umbral: 0.8, espera: "desconocido" },
  { nombre: "duración cero no divide", cobertura: 10, duracion: 0, umbral: 0.8, espera: "desconocido" },
  { nombre: "cobertura pasada de largo", cobertura: 46.2, duracion: 45.8, umbral: 0.8, espera: "completo" },
  { nombre: "borde exacto: >= incluye la igualdad", cobertura: 40, duracion: 50, umbral: 0.8, espera: "completo" },
] as const satisfies readonly {
  nombre: string; cobertura: number | null; duracion: number | null; umbral: number; espera: Veredicto;
}[];
