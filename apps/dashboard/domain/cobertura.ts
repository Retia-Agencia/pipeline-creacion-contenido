// El corte de Supadata (ADR-095). Dominio puro: sin IO, sin React, sin `@/`.
//
// ⚠️ ESTE ARCHIVO VIVE DOS VECES. La copia de n8n está en el nodo `Transcribir (Supadata)` de
// Workflows/workflow-short-form-content/workflow.json, porque un Code node no puede importar del
// repo. Lo que las mantiene juntas NO es este comentario: es `test-nodos.mjs`, que importa las
// tablas de casos de acá y las corre contra la copia. Si divergen, ese test falla.
//
// 🩸 **Ese mecanismo pinzaba UNA de tres funciones, y la que dejaba libre era la del invariante.**
// `CASOS_COBERTURA` es una tabla de `(cobertura, duracion, umbral) → veredicto`, así que sólo podía
// ejercitar `veredictoCobertura`; `textoDeSegmentos` —la que sostiene ADR-009: el motor y el
// cockpit tienen que producir el MISMO script literal— quedaba sin pinzar, **y ya había divergido**
// (ver su comentario). Desde el review final las tablas son TRES y cubren las cinco funciones:
//
//   · `CASOS_SEGMENTOS`  → `textoDeSegmentos` + `coberturaDeSegmentos`
//   · `CASOS_RESPUESTA`  → `textoDeRespuesta` + `coberturaDeRespuesta`
//   · `CASOS_COBERTURA`  → `veredictoCobertura`
//
// Y el umbral se compara aparte, valor contra valor: vivía FUERA de los marcadores `⤵/⤴ COPIA
// TEXTUAL` del nodo, o sea fuera del bloque que el test extrae, así que podía moverse de un lado
// sin que nada gritara. Hoy está adentro del bloque y `test-nodos.mjs` lo compara contra el de acá.

export type Segmento = { text: string; offset: number; duration: number };
export type Veredicto = "completo" | "parcial" | "desconocido";

/**
 * Idéntico carácter por carácter a lo que Supadata devuelve con `text=true` (verificado 09/09).
 *
 * 🔑 **La guarda y el `??` no son estilo: son la alineación con la copia del nodo** (hallazgo del
 * review final). Las dos copias diferían en las dos cosas y el resultado divergía de verdad:
 * con `{text: 0}` una daba `"0"` y la otra `""`, y con un `segs` que no es arreglo una tiraba y la
 * otra devolvía `""`. Gana **esta** forma en las dos, por dos motivos escritos:
 *
 *  · `?? ""` en vez de `|| ""` porque **nunca pierde texto en silencio**: `|| ""` tira cualquier
 *    valor falsy, así que un `0` que Supadata mandara en `text` desaparecería sin log. Perder
 *    texto sin avisar es exactamente el fallo que ADR-095 vino a matar.
 *  · La guarda `Array.isArray` porque este archivo lo copia un Code node de n8n, donde un `.map`
 *    sobre algo que no es arreglo tumba el nodo entero (invariante #1 de PLAN §2.5: un nodo de
 *    compra se degrada, no se cae). Acá adentro es un no-op —el tipo ya lo garantiza— y ese es el
 *    punto: cuesta nada y hace que las dos copias sean el MISMO texto.
 */
export function textoDeSegmentos(segs: readonly Segmento[]): string {
  return (Array.isArray(segs) ? segs : []).map((s) => String(s?.text ?? "")).join(" ");
}

/** Hasta qué segundo llega el transcript. `null` = no se puede saber, que NO es cero. */
export function coberturaDeSegmentos(segs: readonly Segmento[]): number | null {
  if (!Array.isArray(segs) || segs.length === 0) return null;
  const u = segs[segs.length - 1];
  const fin = Number(u?.offset ?? 0) + Number(u?.duration ?? 0);
  return Number.isFinite(fin) ? Math.round(fin / 100) / 10 : null;
}

/**
 * Una respuesta cruda de Supadata. `unknown` a propósito: lo que llega es JSON de afuera, y las dos
 * ramas de abajo existen justamente porque su forma ya cambió una vez.
 */
export type RespuestaSupadata = { content?: unknown; text?: unknown };

/** Los segmentos de la respuesta, o `[]` si vino con la forma vieja (o con basura). */
export function segmentosDeRespuesta(cuerpo: RespuestaSupadata | null | undefined): Segmento[] {
  return Array.isArray(cuerpo?.content) ? (cuerpo.content as Segmento[]) : [];
}

/**
 * El texto de una respuesta de Supadata, venga con la forma nueva (segmentos) o la vieja (string).
 *
 * 🩸 **Existe por un fallo MUDO del review final: con `content: []` el motor y el cockpit
 * producían textos distintos para el mismo video.** El nodo preguntaba `Array.isArray(content)`,
 * que con `[]` da `true`, entraba a la rama de segmentos, sacaba `""` y **nunca miraba `text`**;
 * la app preguntaba `segmentos.length > 0`, caía al fallback y **sí** usaba `text`. Una respuesta
 * `{content: [], text: "..."}` daba guion en el cockpit y "sin voz" en el motor. Es el mismo bug
 * que el nodo celebra haber matado con `lang` vacío, y rompe el invariante de ADR-009 (el motor y
 * el cockpit tienen que producir el MISMO script literal).
 *
 * La regla, una sola vez y para los dos: **manda el contenido, no el contenedor.** Se usan los
 * segmentos sólo si dan texto; si no, se cae al string, y después a `text`.
 */
export function textoDeRespuesta(cuerpo: RespuestaSupadata | null | undefined): string {
  const segs = segmentosDeRespuesta(cuerpo);
  return (
    (segs.length > 0 && textoDeSegmentos(segs)) ||
    (typeof cuerpo?.content === "string" && cuerpo.content) ||
    (typeof cuerpo?.text === "string" && cuerpo.text) ||
    ""
  );
}

/** La cobertura de una respuesta. `null` con la forma vieja: un string no trae timestamps. */
export function coberturaDeRespuesta(cuerpo: RespuestaSupadata | null | undefined): number | null {
  const segs = segmentosDeRespuesta(cuerpo);
  return segs.length > 0 ? coberturaDeSegmentos(segs) : null;
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
  // 🔑 Los seis de arriba corren a 0.8 —el número que ADR-095 §3.4 DESCARTÓ— porque son los tres
  // videos reales y sus bordes, medidos cuando el umbral todavía no existía. Sin estos cuatro, el
  // 0.9 de producción no lo ejercitaba nadie: la tabla probaba una constante que el sistema no usa.
  { nombre: "0.9 real: 53.2/54.0 (DaTf9Wqxt8p) sigue sano", cobertura: 53.2, duracion: 54.0, umbral: UMBRAL_COBERTURA, espera: "completo" },
  { nombre: "0.9 real: 29.0/45.8 (Day8CXdBLwK) sigue cortado", cobertura: 29.0, duracion: 45.8, umbral: UMBRAL_COBERTURA, espera: "parcial" },
  // El caso que SEPARA los dos umbrales, y por eso es el que importa: 40/50 = 0.8 exacto. A 0.8 es
  // "completo" (el borde de arriba) y a 0.9 es "parcial". Si alguien mueve el umbral de un solo
  // lado, este caso y el de arriba no pueden ser los dos verdad.
  { nombre: "0.9 real: 40/50 = 0.8 exacto ⇒ parcial (a 0.8 era completo)", cobertura: 40, duracion: 50, umbral: UMBRAL_COBERTURA, espera: "parcial" },
  { nombre: "0.9 real: borde exacto 45/50", cobertura: 45, duracion: 50, umbral: UMBRAL_COBERTURA, espera: "completo" },
] as const satisfies readonly {
  nombre: string; cobertura: number | null; duracion: number | null; umbral: number; espera: Veredicto;
}[];

/**
 * Segmentos → `{texto, cobertura}`. La tabla que pinza `textoDeSegmentos` y `coberturaDeSegmentos`
 * contra la copia del nodo. `segs: unknown` a propósito: los dos casos degenerados de abajo (no es
 * arreglo / hay basura adentro) son justamente donde las dos copias divergían.
 */
export const CASOS_SEGMENTOS = [
  { nombre: "dos segmentos: une con UN espacio y mide el fin del último",
    segs: [{ text: "hola", offset: 0, duration: 3520 }, { text: "mundo", offset: 14760, duration: 2760 }],
    texto: "hola mundo", cobertura: 17.5 },
  { nombre: "uno solo (Db9Y_EGulGk: 41.5 s)",
    segs: [{ text: "algo", offset: 0, duration: 41500 }], texto: "algo", cobertura: 41.5 },
  { nombre: "vacío: texto vacío y cobertura null, NUNCA cero",
    segs: [], texto: "", cobertura: null },
  { nombre: "🔴 no es un arreglo: no tira, devuelve vacío (el nodo no se puede caer)",
    segs: null, texto: "", cobertura: null },
  { nombre: "🔴 un `text` numérico 0 se conserva como \"0\" (con `|| \"\"` desaparecía sin log)",
    segs: [{ text: 0, offset: 0, duration: 1000 }], texto: "0", cobertura: 1 },
  { nombre: "un segmento sin `text` aporta vacío, no rompe la unión",
    segs: [{ offset: 0, duration: 1000 }, { text: "b", offset: 1000, duration: 1000 }],
    texto: " b", cobertura: 2 },
  { nombre: "offset que no es número ⇒ cobertura null, no NaN",
    segs: [{ text: "a", offset: "x", duration: 1000 }], texto: "a", cobertura: null },
] as const satisfies readonly {
  nombre: string; segs: unknown; texto: string; cobertura: number | null;
}[];

/**
 * Respuesta cruda → `{texto, cobertura}`. Pinza `textoDeRespuesta` y `coberturaDeRespuesta`, o sea
 * la elección de rama (segmentos / string / `text`) que era distinta en cada lado.
 */
export const CASOS_RESPUESTA = [
  { nombre: "forma nueva: segmentos",
    cuerpo: { content: [{ text: "de segmentos", offset: 0, duration: 20000 }] },
    texto: "de segmentos", cobertura: 20 },
  { nombre: "forma vieja: content string, sin cobertura posible",
    cuerpo: { content: "de un string" }, texto: "de un string", cobertura: null },
  { nombre: "🔴 content: [] con text ⇒ gana `text` (el motor devolvía \"\" y el cockpit el texto)",
    cuerpo: { content: [], text: "el fallback" }, texto: "el fallback", cobertura: null },
  { nombre: "🔴 segmentos que suman texto vacío ⇒ también cae al fallback",
    cuerpo: { content: [{ text: "", offset: 0, duration: 5000 }], text: "el fallback" },
    texto: "el fallback", cobertura: 5 },
  { nombre: "sin voz: {error} y nada más",
    cuerpo: { error: "transcript-unavailable" }, texto: "", cobertura: null },
  { nombre: "el 202 de ADR-096: {jobId} es indistinguible de sin voz (documentado, no arreglado)",
    cuerpo: { jobId: "abc" }, texto: "", cobertura: null },
] as const satisfies readonly {
  nombre: string; cuerpo: unknown; texto: string; cobertura: number | null;
}[];

/**
 * La duración de un video, buscada de forma que **no pueda tumbar lo que ya se pagó**.
 *
 * 🩸 **Esto es un arreglo, no una precaución.** `buscarDuracion` hace `throw` si PostgREST devuelve
 * error, y `transcribir/actions.ts` la llamaba **antes** de `marcarResultado({estado: "listo"})`,
 * dentro del `try` cuyo `catch` marca la fila como `fallo`. Un 5xx transitorio de Supabase perdía
 * el transcript de Supadata **y** la traducción de Haiku —las dos ya pagadas— y Majo re-pagaba las
 * dos al apretar `Reintentar`. La duración sólo alimenta una ETIQUETA (el aviso de `avisoDeCobertura`);
 * sin ella el veredicto es `desconocido` y la fila se guarda igual, que es exactamente lo que pasaba
 * antes de ADR-095.
 *
 * 🔑 Es ADR-095 §3.5 al pie de la letra: ***"el peor caso del arreglo tiene que ser el
 * comportamiento actual"***. Acá era peor.
 *
 * Vive en `domain/` y recibe la búsqueda como argumento por una sola razón: así se puede probar que
 * un fallo NO se propaga, sin tocar Supabase.
 */
export async function duracionOpcional(
  buscar: () => Promise<number | null>,
): Promise<number | null> {
  try {
    return await buscar();
  } catch (e) {
    // Se dice, no se disimula: el aviso va a faltar y hay que poder saber por qué.
    console.error("[cobertura] no se pudo buscar la duración, se sigue sin aviso:", e);
    return null;
  }
}
