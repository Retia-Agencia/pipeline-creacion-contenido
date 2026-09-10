#!/usr/bin/env node
// backfill-duraciones-meta.mjs — llenar `app.videos_meta.duracion_seg` de las filas que quedaron
// sin ella. Tarea 10 de docs/agents/plan-transcript-completo.md (ADR-095).
//
// 🔑 **Por qué existe.** La `039` agregó `duracion_seg` sin backfill (correcto: las migraciones no
// compran datos). Las filas anteriores no se curan solas porque `necesitaEnriquecer`
// (`apps/dashboard/domain/colecciones.ts`) las excluye: ya tienen título y referente, y esa función
// dice explícitamente que no compra cosmética. Sin duración no hay veredicto de cobertura, y sin
// veredicto **no hay aviso y no hay reintento** — o sea que la pantalla de Majo queda construida y
// apagada (ADR-095 §Enmienda 3 §D).
//
// 📏 Medido el 2026-09-10: 183 filas en `app.videos_meta`, **150 sin duración**, las 150 de
// Instagram, y las 150 con URL recuperable de `app.transcripciones`. Ninguna se puede sacar gratis
// de otra tabla (`app.candidatos` y `app.transcripciones` tienen duración de **otros** videos: los
// del motor; el solapamiento con éstas es CERO). Costo estimado: ~$0,0023 por video ⇒ ~$0,35.
//
// ⚠️ **`app.videos_meta` no guarda la URL** (su PK es instance_id+plataforma+external_id y el
// external_id de Instagram es el id numérico, del que NO se puede derivar el shortcode). La URL
// sale de `app.transcripciones`, que sí la tiene. Si una fila no tiene URL en ningún lado, se
// saltea y se dice: no se inventa.
//
// Uso:
//   set -a && source .env && set +a
//   node Workflows/workflow-short-form-content/backfill-duraciones-meta.mjs                 # dry-run
//   node Workflows/workflow-short-form-content/backfill-duraciones-meta.mjs --limite 3 --apply
//   node Workflows/workflow-short-form-content/backfill-duraciones-meta.mjs --apply
//   node Workflows/workflow-short-form-content/backfill-duraciones-meta.mjs --filas --apply
//
// 🔑 **`--filas` es el segundo escalón, y es GRATIS.** Llenar `app.videos_meta` no enciende el aviso
// de la pantalla de Majo: `fila.tsx` deriva el veredicto de `t.duracion_seg` de **la fila de
// `app.transcripciones`**, que se copia en el momento de transcribir. Las filas transcritas cuando
// `videos_meta` todavía no tenía duración quedaron con `null` y no se curan solas. `--filas` copia
// lo que ya está comprado, sin tocar Apify, y sólo sobre las filas que tienen `cobertura_seg` (sin
// cobertura no hay veredicto posible, así que copiar la duración ahí no dibuja nada).
//
// Verificación POR SU EFECTO (no por haber corrido), en el SQL Editor o por PostgREST:
//   · `count(*) where duracion_seg is not null` sube;
//   · **`count(*)` total NO se mueve**. Es un UPDATE por PK, no un insert: si el total sube, algo
//     está creando filas y el backfill está duplicando en vez de completar.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, APIFY_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('⛔ faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE. `set -a && source .env && set +a`');
  process.exit(1);
}
if (!APIFY_TOKEN) {
  console.error('⛔ falta APIFY_TOKEN: sin él no hay de dónde sacar la duración.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FILAS = args.includes('--filas');
const LIMITE = args.indexOf('--limite') >= 0 ? Number(args[args.indexOf('--limite') + 1]) : null;
const TOPE_POR_LOTE = 50; // igual que apps/dashboard/lib/apify.ts: el costo del actor es arrancar.

const sb = async (path) => {
  const salida = [];
  for (let off = 0; ; off += 1000) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=1000&offset=${off}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Accept-Profile': 'app',
      },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status} en ${path}: ${await r.text()}`);
    const pagina = await r.json();
    salida.push(...pagina);
    if (pagina.length < 1000) return salida;
  }
};

const sbPatch = async (path, body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
      'Content-Profile': 'app',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} en PATCH ${path}: ${await r.text()}`);
};

/**
 * Fail-open, igual que `apps/dashboard/lib/apify.ts` y que `medir-cobertura.mjs`: un lote que Apify
 * no conteste queda sin duración y se dice, no tumba el resto. Enriquecer es el adorno.
 * El cuerpo del pedido es el MISMO que el de esos dos (`directUrls` + `resultsType: 'posts'`), y el
 * orden de preferencia del id también (`id` primero): si divergiera, el cruce contra la PK falla.
 */
async function duracionesDeApify(filas) {
  const mapa = new Map();
  for (let i = 0; i < filas.length; i += TOPE_POR_LOTE) {
    const lote = filas.slice(i, i + TOPE_POR_LOTE);
    try {
      const r = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            directUrls: lote.map((f) => f.url),
            resultsType: 'posts',
            resultsLimit: 1,
            addParentData: false,
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!r.ok) {
        console.log(`⚠️ Apify respondió ${r.status} para un lote de ${lote.length}: quedan sin duración.`);
        continue;
      }
      const items = await r.json();
      for (const item of Array.isArray(items) ? items : []) {
        const eid = String(item.id ?? item.shortCode ?? item.shortcode ?? '');
        const dur = Number(item.videoDuration);
        if (eid && Number.isFinite(dur) && dur > 0) mapa.set(eid, dur);
      }
      console.log(`  lote ${i / TOPE_POR_LOTE + 1}: ${lote.length} pedidas, ${mapa.size} duraciones acumuladas`);
    } catch (e) {
      console.log(`⚠️ Apify falló para un lote de ${lote.length}: ${e}. Quedan sin duración (fail-open).`);
    }
  }
  return mapa;
}

const metas = await sb('videos_meta?select=instance_id,plataforma,external_id,duracion_seg');

// ── `--filas`: copiar a `app.transcripciones` lo que ya está comprado. Cero llamadas a Apify. ──
if (FILAS) {
  const dur = new Map(metas.filter((m) => m.duracion_seg != null)
    .map((m) => [`${m.plataforma}|${m.external_id}`, Number(m.duracion_seg)]));
  const filas = await sb('transcripciones?select=id,plataforma,external_id,cobertura_seg,duracion_seg&cobertura_seg=not.is.null&duracion_seg=is.null');
  const curables = filas.filter((f) => dur.has(`${f.plataforma}|${f.external_id}`));
  console.log(`Filas con cobertura y sin duración: ${filas.length} · con duración ya comprada: ${curables.length}`);
  const parciales = curables.filter((f) => f.cobertura_seg < dur.get(`${f.plataforma}|${f.external_id}`) * 0.9);
  console.log(`De esas, PARCIALES al 0.9 (o sea, guiones cortados que hoy no avisan): ${parciales.length}`);
  if (!APPLY) {
    console.log('\n(dry-run: no se escribió una fila. Agregá --apply.)');
    process.exit(0);
  }
  let n = 0;
  for (const f of curables) {
    await sbPatch(`transcripciones?id=eq.${f.id}`, { duracion_seg: dur.get(`${f.plataforma}|${f.external_id}`) });
    n++;
  }
  console.log(`\n✓ ${n} filas ahora pueden dar veredicto. El aviso lo dibuja \`fila.tsx\` al leer: el veredicto NUNCA se guarda (ADR-095 §3.1).`);
  process.exit(0);
}

const sinDuracion = metas.filter((m) => m.duracion_seg == null);
console.log(`app.videos_meta: ${metas.length} filas · ${metas.length - sinDuracion.length} con duración · ${sinDuracion.length} sin.`);

// La URL sale de `app.transcripciones`: `videos_meta` no la guarda.
const trans = await sb('transcripciones?select=plataforma,external_id,url');
const urlDe = new Map(trans.filter((t) => t.url).map((t) => [`${t.plataforma}|${t.external_id}`, t.url]));

const conUrl = [], sinUrl = [];
for (const m of sinDuracion) {
  const u = urlDe.get(`${m.plataforma}|${m.external_id}`);
  (u ? conUrl : sinUrl).push(u ? { ...m, url: u } : m);
}
if (sinUrl.length) {
  console.log(`⚠️ ${sinUrl.length} filas sin duración NO tienen URL en ninguna tabla: se saltean (no se inventa una).`);
}

const objetivo = LIMITE != null ? conUrl.slice(0, LIMITE) : conUrl;
console.log(`A pedirle a Apify: ${objetivo.length}${LIMITE != null ? ` (--limite ${LIMITE})` : ''} · ~$${(objetivo.length * 0.0023).toFixed(2)} estimados.`);
if (!objetivo.length) process.exit(0);

if (!APPLY) {
  console.log('\n(dry-run: no se pidió nada a Apify ni se escribió una fila. Agregá --apply.)');
  console.log('Las primeras 3 que se pedirían:');
  objetivo.slice(0, 3).forEach((o) => console.log(`  ${o.plataforma}:${o.external_id} → ${o.url}`));
  process.exit(0);
}

const duraciones = await duracionesDeApify(objetivo);

let escritas = 0, sinRespuesta = 0;
for (const o of objetivo) {
  const dur = duraciones.get(String(o.external_id));
  if (dur == null) { sinRespuesta++; continue; }
  // UPDATE por la PK completa. Nunca inserta: si la fila no existiera, no hay nada que completar.
  await sbPatch(
    `videos_meta?instance_id=eq.${o.instance_id}&plataforma=eq.${o.plataforma}&external_id=eq.${encodeURIComponent(o.external_id)}`,
    { duracion_seg: dur },
  );
  escritas++;
}
console.log(`\n✓ escritas: ${escritas} · sin respuesta de Apify: ${sinRespuesta}`);
console.log('Verificá por su efecto: `count(*) where duracion_seg is not null` sube y el `count(*)` TOTAL no se mueve.');
