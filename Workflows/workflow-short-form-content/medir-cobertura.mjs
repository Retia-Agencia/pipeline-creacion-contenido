#!/usr/bin/env node
// medir-cobertura.mjs — mide cuánto del video cubrió cada transcript del caché, y completa los
// cortados. Dry-run por defecto: escribe sólo con --apply. ADR-095, Tarea 3 de plan-transcript-completo.
//
//   set -a && source .env && set +a && node Workflows/workflow-short-form-content/medir-cobertura.mjs [flags]
//
//   --medir (default)     lee origen=motor/estado=listo, pide segmentos a Supadata en `auto`,
//                          calcula cobertura, completa duración (candidatos → videos_meta → Apify)
//                          e imprime el histograma. Sin --apply NO escribe una sola fila.
//   --apply                junto con --medir: además persiste cobertura_seg/duracion_seg/modo='auto'.
//                          junto con --completar: única forma de que --completar haga algo.
//   --limite N             acota cuántas filas procesa (para probar barato).
//   --completar --umbral X --apply
//                          sobre las filas YA medidas (cobertura_seg/duracion_seg en la base) que
//                          quedaron bajo `umbral`, pide `generate` una sola vez y se queda con la
//                          que cubre más segundos. Nunca pisa un guion sano (empate o menos = no se
//                          escribe).
//
// 🔴 Corrección al brief (Mani, 09/09): el brief decía "dry-run por defecto" y en el mismo párrafo
// que `--medir` escribe sin más — las dos cosas no pueden ser ciertas. Manda esto: `--medir` solo
// mide y muestra; `--medir --apply` persiste. Ver docs/agents/handoff.md de la Tarea 3.
//
// Fail-open en todo: sin duración no hay veredicto (la fila queda con cobertura y sin duración,
// legible después); si Apify no contesta, esas filas se dicen en la salida y no se inventa nada.
import { coberturaDeSegmentos, textoDeSegmentos } from '../../apps/dashboard/domain/cobertura.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPADATA_API_KEY, APIFY_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !SUPADATA_API_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE / SUPADATA_API_KEY. Cargá el .env:');
  console.error('  set -a && source .env && set +a && node <este archivo>');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const valor = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const APPLY = flag('apply');
const UMBRAL = Number(valor('umbral', 0.8));
const LIMITE = valor('limite', null) != null ? Number(valor('limite', null)) : null;
const COMPLETAR = flag('completar');

// ═══════════════════ Las tres piezas del brief, verbatim (no se re-deciden) ═══════════════════

/** Una respuesta de Supadata, ya normalizada. `cobertura: null` = no se pudo medir. */
async function pedir(url, modo) {
  const r = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&mode=${modo}`,
    { headers: { 'x-api-key': process.env.SUPADATA_API_KEY }, signal: AbortSignal.timeout(90_000) },
  );
  const b = await r.json().catch(() => ({}));
  const segs = Array.isArray(b.content) ? b.content : [];
  return { texto: textoDeSegmentos(segs).trim().slice(0, 6000), cobertura: coberturaDeSegmentos(segs),
           lang: String(b.lang || '').toLowerCase().slice(0, 2), status: r.status };
}

/**
 * 🔑 Gana el que CUBRE MÁS, no el que trae más texto. Medido el 09/09 en `DaTf9Wqxt8p`: `generate`
 * traía 2 caracteres contra 95 de `auto` y cubría 39 s contra 53.2 s. Elegir por largo habría
 * pisado un guion sano con basura.
 * Y ante empate gana el viejo: no se reescribe una fila para dejarla igual.
 */
function mejor(actual, candidato) {
  if (candidato.cobertura == null) return actual;
  if (actual.cobertura == null) return candidato;
  return candidato.cobertura > actual.cobertura ? candidato : actual;
}

/** El histograma es la salida del modo --medir: de acá sale el umbral, no de una opinión. */
function histograma(ratios) {
  const n = ratios.length;
  if (!n) return 'sin datos';
  const orden = [...ratios].sort((a, b) => a - b);
  const bins = Array.from({ length: 10 }, (_, i) =>
    ratios.filter((r) => r >= i / 10 && r < (i + 1) / 10).length);
  bins[9] += ratios.filter((r) => r >= 1).length;
  return [
    `n=${n}  mediana=${orden[Math.floor(n / 2)].toFixed(3)}  p10=${orden[Math.floor(n * 0.1)].toFixed(3)}`,
    ...bins.map((c, i) => `  ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${'█'.repeat(Math.round(40 * c / n))} ${c}`),
  ].join('\n');
}

// ═══════════════════════════════ PostgREST (patrón de verificar-corrida.mjs / rescatar-huerfanos.mjs) ═══════════════════════════════

const sb = async (path, esquema) => {
  const salida = [];
  for (let off = 0; ; off += 1000) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=1000&offset=${off}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        ...(esquema ? { 'Accept-Profile': esquema } : {}),
      },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status} en ${path}: ${await r.text()}`);
    const pagina = await r.json();
    salida.push(...pagina);
    if (pagina.length < 1000) return salida;
  }
};

const sbPatch = async (path, esquema, body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
      ...(esquema ? { 'Content-Profile': esquema } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} en PATCH ${path}: ${await r.text()}`);
};

// ═══════════════════════════════ concurrencia 8 + backoff ═══════════════════════════════
// Mismo tope que el nodo `Transcribir (Supadata)`: el plan de Supadata es 10 req/s y el límite se
// cobra en el pico, no en el promedio.

async function pMapLimit(items, limit, fn) {
  const salida = new Array(items.length);
  let i = 0;
  async function trabajador() {
    while (i < items.length) {
      const idx = i++;
      salida[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, trabajador));
  return salida;
}

/** Reintenta SOLO 429 (rate limit); cualquier otro status lo devuelve tal cual (fail-open: sin
 *  cobertura no hay veredicto, no hay excepción que tirar). */
async function pedirConBackoff(url, modo, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    ultimo = await pedir(url, modo);
    if (ultimo.status !== 429) return ultimo;
    await new Promise((res) => setTimeout(res, 500 * 2 ** i));
  }
  return ultimo;
}

// ═══════════════════════════════ duración: candidatos → videos_meta → Apify ═══════════════════════════════
// Orden del brief: `app.candidatos.duracion_seg` (157 filas ya pobladas, cruzando por external_id),
// después `app.videos_meta.duracion_seg` (hoy vacía, la Tarea 6 la llena), y recién si falta, Apify.

const TOPE_POR_LOTE = 50; // igual a apps/dashboard/lib/apify.ts: el costo del actor es arrancar.

async function mapaDuracion(tabla, ids) {
  const mapa = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    if (!lote.length) continue;
    const filas = await sb(
      `${tabla}?select=external_id,duracion_seg&external_id=in.(${lote.join(',')})&duracion_seg=not.is.null`,
      'app',
    );
    for (const f of filas) if (!mapa.has(f.external_id)) mapa.set(f.external_id, Number(f.duracion_seg));
  }
  return mapa;
}

/** Fail-open: sin APIFY_TOKEN o si Apify falla, devuelve lo que pudo (posiblemente vacío) y lo dice. */
async function duracionesDeApify(rows) {
  const mapa = new Map();
  if (!rows.length) return mapa;
  if (!APIFY_TOKEN) {
    console.log(`⚠️ falta APIFY_TOKEN: ${rows.length} filas sin duración de candidatos/videos_meta quedan sin duración.`);
    return mapa;
  }
  for (let i = 0; i < rows.length; i += TOPE_POR_LOTE) {
    const lote = rows.slice(i, i + TOPE_POR_LOTE);
    try {
      const r = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            directUrls: lote.map((r) => r.url),
            resultsType: 'posts',
            resultsLimit: 1,
            addParentData: false,
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (!r.ok) {
        console.log(`⚠️ Apify respondió ${r.status} para un lote de ${lote.length} urls: quedan sin duración.`);
        continue;
      }
      const items = await r.json();
      for (const item of Array.isArray(items) ? items : []) {
        // Mismo orden de preferencia que apps/dashboard/lib/apify.ts (`normalizar`): `id` primero.
        const eid = String(item.id ?? item.shortCode ?? item.shortcode ?? '');
        const dur = Number(item.videoDuration);
        if (eid && Number.isFinite(dur) && dur > 0) mapa.set(eid, dur);
      }
    } catch (e) {
      console.log(`⚠️ Apify falló para un lote de ${lote.length} urls: ${e}. Quedan sin duración (fail-open).`);
    }
  }
  return mapa;
}

// ═══════════════════════════════ --medir ═══════════════════════════════

async function medir(rows) {
  console.log(`Filas a medir: ${rows.length}`);
  const externalIds = rows.map((r) => r.external_id);
  const [porCandidato, porVideoMeta] = await Promise.all([
    mapaDuracion('candidatos', externalIds),
    mapaDuracion('videos_meta', externalIds),
  ]);
  const sinDuracionDeTablas = rows.filter(
    (r) => !porCandidato.has(r.external_id) && !porVideoMeta.has(r.external_id),
  );
  const porApify = await duracionesDeApify(sinDuracionDeTablas);

  const duracionDe = (r) =>
    porCandidato.get(r.external_id) ?? porVideoMeta.get(r.external_id) ?? porApify.get(r.external_id) ?? null;

  let fallosSupadata = 0;
  const resultados = await pMapLimit(rows, 8, async (r) => {
    let resp;
    try {
      resp = await pedirConBackoff(r.url, 'auto');
    } catch (e) {
      fallosSupadata++;
      return { ...r, cobertura: null, duracion: duracionDe(r) };
    }
    if (resp.cobertura == null) fallosSupadata++;
    return { ...r, cobertura: resp.cobertura, duracion: duracionDe(r) };
  });

  const ratios = [];
  let sinDuracion = 0;
  for (const res of resultados) {
    if (res.duracion == null) { sinDuracion++; continue; }
    if (res.cobertura == null) continue;
    ratios.push(res.cobertura / res.duracion);
  }

  console.log('\n═══ HISTOGRAMA cobertura/duración ═══');
  console.log(histograma(ratios));
  console.log(
    `\nfilas procesadas: ${resultados.length} · sin cobertura (Supadata no contestó o vacío): ${fallosSupadata} · sin duración: ${sinDuracion}`,
  );

  if (!APPLY) {
    console.log('\n(dry-run: no se escribió una sola fila. Agregá --apply para persistir cobertura_seg/duracion_seg/modo.)');
    return;
  }

  let escritas = 0;
  await pMapLimit(resultados, 8, async (res) => {
    if (res.cobertura == null) return;
    const patch = { cobertura_seg: res.cobertura, modo: 'auto' };
    if (res.duracion != null) patch.duracion_seg = res.duracion;
    await sbPatch(`transcripciones?id=eq.${res.id}`, 'app', patch);
    escritas++;
  });
  console.log(`\n✓ escritas ${escritas} filas de ${resultados.length} (las sin cobertura quedaron intactas).`);
}

// ═══════════════════════════════ --completar ═══════════════════════════════

async function completar(rows) {
  if (!APPLY) {
    console.error('⛔ --completar necesita --apply: sin escribir no hay nada que "completar".');
    process.exit(1);
  }
  const candidatas = rows.filter(
    (r) => r.cobertura_seg != null && r.duracion_seg != null && r.duracion_seg > 0
      && r.cobertura_seg < r.duracion_seg * UMBRAL,
  );
  console.log(`Filas bajo el umbral ${UMBRAL}: ${candidatas.length} de ${rows.length} (las demás no tienen cobertura/duración medida, o ya están sanas).`);

  let completadas = 0, sinMejora = 0, sinRespuesta = 0;
  await pMapLimit(candidatas, 8, async (r) => {
    let resp;
    try {
      resp = await pedirConBackoff(r.url, 'generate');
    } catch (e) {
      sinRespuesta++;
      return;
    }
    if (resp.cobertura == null) { sinRespuesta++; return; }
    const actual = { texto: r.script, cobertura: r.cobertura_seg };
    const candidato = { texto: resp.texto, cobertura: resp.cobertura };
    const ganador = mejor(actual, candidato);
    if (ganador !== candidato) { sinMejora++; return; }
    await sbPatch(`transcripciones?id=eq.${r.id}`, 'app', {
      script: candidato.texto, cobertura_seg: candidato.cobertura, modo: 'generate',
    });
    completadas++;
  });
  console.log(`\n✓ completadas: ${completadas} · sin mejora (quedó auto, no se pisó): ${sinMejora} · sin respuesta de Supadata: ${sinRespuesta}`);
}

// ═══════════════════════════════ main ═══════════════════════════════

async function main() {
  let rows = await sb(
    'transcripciones?select=id,external_id,plataforma,url,script,cobertura_seg,duracion_seg,modo&origen=eq.motor&estado=eq.listo&order=creado_en.asc',
    'app',
  );
  console.log(`Filas origen=motor / estado=listo en app.transcripciones: ${rows.length}`);
  if (LIMITE != null) {
    rows = rows.slice(0, LIMITE);
    console.log(`Acotado por --limite ${LIMITE}: ${rows.length} filas`);
  }

  if (COMPLETAR) await completar(rows);
  else await medir(rows);
}

await main();
