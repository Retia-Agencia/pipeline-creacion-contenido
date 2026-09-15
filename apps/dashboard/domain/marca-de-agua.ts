// Dominio puro (C3) de ADR-100: desde cuándo se le compra a cada cuenta, cuánto se le pide, y qué
// reels jóvenes se re-miden por URL. Sin IO: la fachada lee las vistas de la `045` y le pasa filas.

export const DIAS_JOVEN = 7;
export const FRACCION_PISO_REMEDIR = 0.25;
export const TOPE_REMEDIR = 200;
export const HOLGURA_CUPO = 1.3;
const DIA_MS = 86_400_000;

/** La misma normalización que escribe `pool_crudo` (backfill y motor): sin `@`, minúsculas. */
export function normalizarHandlePool(h: string): string {
  return String(h ?? "").trim().replace(/^@/, "").toLowerCase();
}

/** D1: `max(marca, ahora − días)`. Sin marca o ilegible, el techo. */
export function desdeDe(watermark: string | null, diasRecencia: number, ahora: Date): string {
  const techo = ahora.getTime() - diasRecencia * DIA_MS;
  const marca = watermark ? Date.parse(watermark) : Number.NaN;
  return new Date(Number.isFinite(marca) ? Math.max(marca, techo) : techo).toISOString();
}

/** D2: el cupo que tapa el hueco. Apify cobra lo que vuelve, así que el piso es inofensivo. */
export function limiteDe(ritmoSemanal: number | null, desde: string, resultadosPorCuenta: number, ahora: Date): number {
  const dias = Math.max(0, (ahora.getTime() - Date.parse(desde)) / DIA_MS);
  const estimado = Math.ceil(((ritmoSemanal ?? 0) * dias / 7) * HOLGURA_CUPO);
  return Math.max(resultadosPorCuenta, estimado);
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SESENTA_Y_CUATRO = BigInt(64);
const CERO = BigInt(0);

/** Media id numérico de Instagram → shortcode. `pool_crudo` no guarda URL. */
export function shortcodeDe(mediaId: string): string | null {
  if (!/^\d+$/.test(mediaId)) return null;
  let n = BigInt(mediaId);
  if (n === CERO) return null;
  let s = "";
  while (n > CERO) {
    s = ALFABETO[Number(n % SESENTA_Y_CUATRO)] + s;
    n = n / SESENTA_Y_CUATRO;
  }
  return s;
}

export type Observacion = {
  external_id: string;
  handle: string;
  publicado_en: string;
  medido_en: string;
  vistas: number;
  edad_al_medir_dias: number;
};
export type ReelARemedir = { external_id: string; handle: string; url: string };

/** D3: lo joven y cerca del piso. Se vacía solo: re-medido, ya no es joven al medirse. */
export function elegirRemedir(
  obs: Observacion[],
  o: {
    piso: number;
    diasRecencia: number;
    handlesActivos: Set<string>;
    ahora: Date;
    tope?: number;
    /** Cuándo se movió `Mínimo de vistas` por última vez. `null` = sin rescate. */
    pisoCambioEn?: string | null;
  },
): { lista: ReelARemedir[]; cortados: number } {
  const t = o.ahora.getTime();
  const cambio = o.pisoCambioEn ? Date.parse(o.pisoCambioEn) : Number.NaN;
  // Joven y cerca del piso: puede cruzarlo (§1.4).
  const esJoven = (x: Observacion) =>
    x.edad_al_medir_dias < DIAS_JOVEN && x.vistas >= o.piso * FRACCION_PISO_REMEDIR && x.vistas < o.piso;
  // Rescate por cambio de piso: hoy lo pasa y su última medición es anterior al cambio, así que nunca
  // tuvo su oportunidad con este piso. Una sola vez: re-medido, su medición ya es posterior al cambio.
  // Sin esto la marca de agua lo dejaría afuera para siempre (ADR-100 §D3, rescate).
  const esRescate = (x: Observacion) =>
    Number.isFinite(cambio) && x.vistas >= o.piso && Date.parse(x.medido_en) < cambio;
  const elegibles = obs
    .filter(
      (x) =>
        (esJoven(x) || esRescate(x)) &&
        t - Date.parse(x.medido_en) >= DIA_MS &&
        t - Date.parse(x.publicado_en) <= o.diasRecencia * DIA_MS &&
        o.handlesActivos.has(normalizarHandlePool(x.handle)) &&
        shortcodeDe(x.external_id) !== null,
    )
    .sort((a, b) => b.vistas - a.vistas);
  const tope = o.tope ?? TOPE_REMEDIR;
  const lista = elegibles.slice(0, tope).map((x) => ({
    external_id: x.external_id,
    handle: normalizarHandlePool(x.handle),
    url: `https://www.instagram.com/reel/${shortcodeDe(x.external_id)}/`,
  }));
  return { lista, cortados: Math.max(0, elegibles.length - tope) };
}

/**
 * Cuándo se tocó un ajuste por última vez, o `null`. ⚠️ Mientras la `043` (ADR-097) no esté
 * aplicada, un cambio hecho por SQL no mueve esta fecha: el rescate simplemente no se dispara, que es
 * el lado seguro (no paga de más).
 */
export function fechaAjuste(ajustes: { fields: Record<string, unknown> }[], clave: string): string | null {
  const v = ajustes.find((a) => a.fields.clave === clave)?.fields.actualizado_en;
  return typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
}

/** Lee un ajuste del plan por clave. Un 0 es un valor, no un faltante. */
export function valorAjuste(ajustes: { fields: Record<string, unknown> }[], clave: string, defecto: number): number {
  const v = ajustes.find((a) => a.fields.clave === clave)?.fields.valor;
  const n = typeof v === "number" ? v : Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? defecto : n;
}
