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
//                          junto con --completar: única forma de que --completar escriba. Sin él,
//                          --completar lista las candidatas y no pide nada (dry-run).
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
import { coberturaDeSegmentos, ganaElReintento, textoDeSegmentos, yaProboGenerate } from '../../apps/dashboard/domain/cobertura.ts';

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
const LIMITE = valor('limite', null) != null ? Number(valor('limite', null)) : null;
const COMPLETAR = flag('completar');

// `--umbral` es obligatorio en `--completar` (escribe producción) y tiene default solo en `--medir`
// (ahí solo colorea el histograma, no escribe nada). El §3.4 del spec existe para que el número
// salga del histograma medido, no de una opinión previa — un default silencioso se lo saltea.
// Ese default es 0.9 desde el review final: ver el porqué al lado de la constante.
if (COMPLETAR && valor('umbral', null) == null) {
  console.error('⛔ --completar necesita --umbral: el umbral se elige mirando el histograma de');
  console.error('   --medir, no una opinión previa. Corré --medir primero y pasá el número que veas.');
  process.exit(1);
}
const UMBRAL_TENIA_DEFAULT = valor('umbral', null) == null;
// 🩸 El default era **0.8**, o sea el número que ADR-095 §3.4 DESCARTÓ mirando el histograma que
// este mismo script produjo. Un tercer lugar con el umbral y un valor distinto de los otros dos: la
// próxima persona que corriera `--medir` sin flag habría leído un histograma coloreado contra un
// corte que el sistema no usa. El único umbral del producto es **0.9** (`UMBRAL_COBERTURA` en
// `apps/dashboard/domain/cobertura.ts`, copiado dentro del bloque textual del nodo, y comparado
// entre los dos por `test-nodos.mjs`). Acá no se importa porque este script es node pelado y corre
// contra prod, pero el número y su porqué son los mismos: si cambia allá, cambia acá.
const UMBRAL = Number(valor('umbral', 0.9));

// ═══════════════════ Las tres piezas del brief, verbatim (no se re-deciden) ═══════════════════

/** Una respuesta de Supadata, ya normalizada. `cobertura: null` = no se pudo medir. */
async function pedir(url, modo) {
  // 🩸 `generate` no es `auto` con otro nombre: `auto` devuelve subtítulos que ya existen y
  // `generate` corre un ASR contra el audio, que tarda MUCHO más. Medido el 10/09 en la primera
  // corrida de la Tarea 9: con 90 s para los dos modos, los 23 cortados se partieron **exacto por
  // duración** — los 7 de ≤25.7 s contestaron y los 16 de ≥25.9 s murieron por timeout, y uno de
  // esos 16 pedido solo contestó 200 con transcript. Cero completadas por un número, no por la API.
  const timeoutMs = modo === 'generate' ? 240_000 : 90_000;
  const r = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&mode=${modo}`,
    { headers: { 'x-api-key': process.env.SUPADATA_API_KEY }, signal: AbortSignal.timeout(timeoutMs) },
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
// La regla del ganador vive en `domain/cobertura.ts` (`ganaElReintento`) y se importa: era la
// TERCERA copia de la misma comparación —el nodo, el .ts y ésta— y es justo la que decide si se
// pisa un guion ya pagado. Las otras dos ya están pinzadas entre sí por `test-nodos.mjs`.

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

// ═══════════════════════════════ concurrencia 8 + arranque escalonado + backoff con jitter ═══════
// Arranque y backoff tomados del nodo `Transcribir (Supadata)` (Config: arranque_transcribir_ms=120,
// backoff_transcribir_ms=500). Concurrencia: script usa 8 (más conservador que el motor, que corre con 12).
// El plan de Supadata
// es 10 req/s y el límite se cobra en el PICO, no en el promedio — dos picos distintos, dos fixes:
//
// 1) ARRANQUE ESCALONADO: `Promise.all(Array.from({length:N}, worker))` lanza los N workers en el
//    mismo tick — N pedidos en el mismo milisegundo, que es el propio pico del nodo. El comentario
//    de `Transcribir (Supadata)` lo mide: a 12 en vuelo sin escalonar la ráfaga de arranque ya
//    pasaba el techo de 10 req/s aunque en régimen 12 en vuelo a ~19s de latencia sean 0.62 req/s.
//    120ms entre worker y worker ≈ 8.3 req/s de pico, debajo del techo con margen.
// 2) JITTER EN EL BACKOFF: sin aleatoriedad, los N workers que se comieron el mismo 429 esperan
//    exactamente lo mismo y RECONSTRUYEN la ráfaga que los tumbó (comentario textual del nodo). Acá
//    la propia corrida quemó media cosecha en producción por esto.
const ARRANQUE_MS = 120;
const BACKOFF_MS = 500;
const RETRIES = 4; // 5 intentos totales, igual que el nodo.

async function pMapLimit(items, limit, fn) {
  const salida = new Array(items.length);
  let i = 0;
  const dormir = (ms) => new Promise((res) => setTimeout(res, ms));
  async function trabajador(k) {
    if (k > 0) await dormir(k * ARRANQUE_MS);
    while (i < items.length) {
      const idx = i++;
      salida[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, (_, k) => trabajador(k)));
  return salida;
}

/** Reintenta SOLO 429 (rate limit); cualquier otro status lo devuelve tal cual (fail-open: sin
 *  cobertura no hay veredicto, no hay excepción que tirar). Backoff exponencial CON jitter
 *  multiplicativo, igual fórmula que el nodo: `BACKOFF_MS * 2^(intento-1) * (1 + Math.random())`. */
async function pedirConBackoff(url, modo, intentos = RETRIES + 1) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    ultimo = await pedir(url, modo);
    if (ultimo.status !== 429) return ultimo;
    await new Promise((res) => setTimeout(res, Math.round(BACKOFF_MS * 2 ** i * (1 + Math.random()))));
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
  if (UMBRAL_TENIA_DEFAULT) {
    console.log(`(usando --umbral por default: ${UMBRAL} — el umbral de producto de ADR-095, el mismo que UMBRAL_COBERTURA en apps/dashboard/domain/cobertura.ts. Acá no escribe nada, solo colorea; para --completar el umbral se pasa a mano mirando el histograma de abajo)`);
  }
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
  // 🔑 `modo === 'generate'` = ya se completó una vez y no mejoró más (ADR-095): un reintento
  // alcanza y el segundo es plata tirada — medido en el propio ADR, 5 llamadas seguidas de
  // `generate` sobre los tres videos de referencia dieron 15 de 15 idénticas. Sin este filtro,
  // correr `--completar --apply` dos veces re-paga 2 créditos por fila (`generate` en `pedir` +
  // el intento de `mejor()`) para recibir la misma respuesta que ya está guardada — el caso
  // documentado como cortado e irrecuperable (`Day8CXdBLwK`) se re-pagaría para siempre.
  // 🩸 ADR-095 §Enmienda 3: esto decía `r.modo === 'generate'` y el comentario de arriba prometía
  // una protección que el código NO daba. `generate` sólo se escribía cuando GANABA, así que un
  // video donde el reintento se probó y perdió —`Day8CXdBLwK`, el ejemplo del propio comentario—
  // volvía a la lista de candidatas en cada corrida. El candado es `auto_tras_generate`, y por eso
  // el predicado es `yaProboGenerate` y no una comparación contra un solo valor.
  const yaCompletadas = rows.filter((r) => yaProboGenerate(r.modo)).length;
  const candidatas = rows.filter(
    (r) => !yaProboGenerate(r.modo) && r.cobertura_seg != null && r.duracion_seg != null && r.duracion_seg > 0
      && r.cobertura_seg < r.duracion_seg * UMBRAL,
  );
  console.log(`Filas bajo el umbral ${UMBRAL}: ${candidatas.length} de ${rows.length} (las demás no tienen cobertura/duración medida, ya están sanas, o ya probaron generate: ${yaCompletadas} se saltean).`);

  // El dry-run del Paso 1 de la Tarea 9: lista a quién le va a pegar ANTES de pagarlo. No hace una
  // sola llamada a Supadata — la lista sale del mismo predicado que usa el --apply de abajo, así
  // que lo que se cuenta acá es exactamente lo que se va a pedir.
  // 🩸 Esto no existía y el plan lo documentaba igual: `--completar --umbral 0.9` sin `--apply`
  // moría con `⛔ --completar necesita --apply` (exit 1). O sea que el único paso que existía para
  // mirar antes de gastar era gastar.
  if (!APPLY) {
    for (const r of candidatas) {
      console.log(`  ${r.external_id}  ${Number(r.cobertura_seg).toFixed(1)}/${Number(r.duracion_seg).toFixed(1)} s = ${(r.cobertura_seg / r.duracion_seg).toFixed(2)}  modo=${r.modo}`);
    }
    console.log(`\n(dry-run: cero llamadas a Supadata y cero filas escritas. Con --apply son ${candidatas.length} llamadas \`generate\` = ${candidatas.length * 2} créditos.)`);
    return;
  }

  let completadas = 0, sinMejora = 0, sinRespuesta = 0;
  await pMapLimit(candidatas, 8, async (r) => {
    let resp;
    try {
      resp = await pedirConBackoff(r.url, 'generate');
    } catch (e) {
      // Se dice CUÁL falló y POR QUÉ: un `sin respuesta: 16` sin nombres no se puede diagnosticar
      // sin volver a pagar. Fail-open igual: la fila queda en `auto` y vuelve a ser candidata.
      console.log(`⚠️ ${r.external_id} (${Number(r.duracion_seg).toFixed(1)}s): ${e.name || e}`);
      sinRespuesta++;
      return;
    }
    if (resp.cobertura == null) {
      console.log(`⚠️ ${r.external_id} (${Number(r.duracion_seg).toFixed(1)}s): status ${resp.status}, sin segmentos`);
      sinRespuesta++;
      return;
    }
    const actual = { texto: r.script, cobertura: r.cobertura_seg };
    const candidato = { texto: resp.texto, cobertura: resp.cobertura };
    if (!ganaElReintento(actual, candidato)) {
      // 🔑 Se escribe el CANDADO aunque no se escriba el guion. El texto de `auto` sigue intacto
      // —no se pisa nada— pero el video queda marcado como "generate ya se probó acá", que es lo
      // único que impide que la próxima corrida del motor y el próximo `--completar` lo vuelvan a
      // pagar. Sin esta línea el filtro de arriba no protege a nadie (ADR-095 §Enmienda 3).
      await sbPatch(`transcripciones?id=eq.${r.id}`, 'app', { modo: 'auto_tras_generate' });
      sinMejora++;
      return;
    }
    await sbPatch(`transcripciones?id=eq.${r.id}`, 'app', {
      script: candidato.texto, cobertura_seg: candidato.cobertura, modo: 'generate',
    });
    completadas++;
  });
  console.log(`\n✓ completadas: ${completadas} · sin mejora (el guion no se pisó; quedan marcados auto_tras_generate y no se re-piden): ${sinMejora} · sin respuesta de Supadata: ${sinRespuesta}`);
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
