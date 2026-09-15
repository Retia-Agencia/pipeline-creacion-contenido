#!/usr/bin/env node
// backfill-pool-crudo.mjs — Copia los datasets ya PAGADOS de Apify a app.pool_crudo, GRATIS.
//
//   set -a && source .env && set +a
//   node core/scripts/backfill-pool-crudo.mjs            # DRY-RUN (default): solo cuenta, no escribe
//   node core/scripts/backfill-pool-crudo.mjs --apply    # escribe a app.pool_crudo por PostgREST
//   npm run backfill:pool            # dry-run    (alias)
//   npm run backfill:pool:apply      # --apply    (alias)
//
// 🔑 POR QUÉ EXISTE. La re-compra dejó el mismo reel medido en varias fechas dentro de datasets que
// Apify YA nos cobró (plan-refactor-motor §1.3, ADR-099). Leer datasets propios no cuesta (costos
// §8.5). Copiarlos a app.pool_crudo es el paso 3 del plan §7 — y el único IRREVERSIBLE:
//
// 🔴 VENCE UN DÍA POR DÍA. Apify (plan STARTER) borra datasets a los 31 días: los más viejos (17/08)
// el 2026-09-17, los del 10/09 el 2026-10-11. Lo que no se copie con `--apply` a tiempo se pierde.
//
// ⚠️ SOLO GET a Apify (lista de runs + items de datasets ya existentes). NO dispara actores, NO
// cuesta. El único que escribe es el UPSERT a PostgREST, y solo con `--apply`.
//
// Idempotente: hace UPSERT contra pool_crudo_dataset_idx (instance, plataforma, external_id,
// apify_dataset_id). Re-correrlo no duplica.

import { readFileSync } from 'node:fs';

// ── Config y secretos (del .env de la raíz, como el resto de core/scripts; nunca se imprimen) ──
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const APPLY = process.argv.includes('--apply');

// Override manual del corte (ISO). Si no viene, el corte se lee de los DATOS: el arranque
// (runs.inicio) del primer run del motor. Ver resolverCorte() para la regla exacta. `--corte
// 2026-09-15T00:00:00Z`.
function leerCorteFlag(argv = process.argv) {
  const i = argv.indexOf('--corte');
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}
const CORTE_FLAG = leerCorteFlag();

// El actor de reels que YA se paga (costos §1.1, ADR-072). El backfill solo mira ESTE actor: las
// corridas de otros actores (p.ej. el de perfiles del descubrimiento) no son scrapes de reels.
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W';               // apify/instagram-scraper
const ACTOR_SLUG = 'apify/instagram-scraper';

// Los secretos se chequean en main(), NO al importar: el test importa las funciones puras sin .env.
function exigirEntorno() {
  if (!APIFY_TOKEN) { console.error('Falta APIFY_TOKEN (está en el .env de la raíz).'); process.exit(1); }
  if (APPLY && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE)) {
    console.error('Con --apply hacen falta SUPABASE_URL y SUPABASE_SERVICE_ROLE (del .env de la raíz).');
    process.exit(1);
  }
}

const APIFY = 'https://api.apify.com/v2';
const getJson = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return r.json().catch(() => null);
};

// ── Normalización: la MISMA cadena de `Normalizar IG` del motor (workflow.json) y de apify.ts ──
// Se exporta para que el test la ejercite sin red. Un item de Apify → una observación del pool, o
// `null` si no sirve (no es video, o no tiene identidad).
export function normalizarItem(item, ctx = {}) {
  if (!item || typeof item !== 'object') return null;
  // Stub de Apify: un {error:...} es rechazo del proveedor, no un reel.
  if (item.error) return null;
  // IG trae fotos y carruseles que no se pueden transcribir: mismo filtro que el motor.
  if (item.type && item.type !== 'Video') return null;
  // Sin id ni url no hay identidad: descartar (igual que el motor).
  const external_id = String(item.id || item.shortCode || item.shortcode || '');
  if (!external_id && !item.url) return null;
  if (!external_id) return null;

  const usuario = item.ownerUsername || item.ownerUserName || '';
  const handle = normalizarHandle(usuario);

  // ⚠️ La cadena exacta del motor: `videoViewCount || videoPlayCount || igPlayCount`. En la práctica
  // `videoViewCount` viene null y las reproducciones están en `videoPlayCount` (medido, ver apify.ts).
  const vistas = numero(item.videoViewCount) ?? numero(item.videoPlayCount) ?? numero(item.igPlayCount);

  const seguidores =
    numero(item.followersCount) ??
    numero(item.ownerFollowersCount) ??
    numero(item.metaData && item.metaData.followersCount);

  return {
    plataforma: 'instagram',
    external_id,
    handle,
    publicado_en: fechaISO(item.timestamp),
    vistas,
    likes: numero(item.likesCount),
    comentarios: numero(item.commentsCount),
    seguidores,
    duracion_seg: numero(item.videoDuration),
    medido_en: ctx.medido_en ?? null,
    apify_run_id: ctx.apify_run_id ?? null,
    apify_dataset_id: ctx.apify_dataset_id ?? null,
    run_id: null,                 // los datasets viejos no siempre cruzan a nuestra corrida; nullable
    origen: ctx.origen ?? 'backfill',
  };
}

// Handle normalizado: sin @, minúsculas, sin espacios. Lo que la tabla espera (ADR-099).
export function normalizarHandle(u) {
  return String(u || '').trim().replace(/^@/, '').toLowerCase();
}

function numero(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function fechaISO(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── ¿Este run es un scrape de reels que queremos copiar? ──
// Solo se filtra por ACTOR: cualquier corrida del actor de reels con dataset se copia, venga de
// donde venga y termine como termine.
// 🔑 No se filtra por `meta.origin` ni por `status`, y es a propósito: una sesión de agente (MCP) o
// una corrida abortada/con timeout TAMBIÉN compró reels reales, y copiarlos es gratis mientras que
// saltearlos es irreversible (Apify los borra a los 31 días). Lo que no sea un reel lo tira
// `normalizarItem` (type != Video, {error}, sin id) — el filtro vive en el item, no en quién pidió.
export function esRunDeReels(run) {
  if (!run || !run.defaultDatasetId) return false;
  const actId = run.actId || run.actorId;
  return !actId || actId === ACTOR_ID;
}

// ── Corte por arranque del motor: NO copiar runs que empezaron cuando el motor ya escribía ──
// 🩸 Desde que el motor escribe app.pool_crudo (nodos 'Preparar/POST pool crudo'), usa un dataset_id
// SINTÉTICO ('motor:<run_id>:<fecha>') porque el nodo Apify de n8n no expone el dataset real. El
// backfill, en cambio, keyea por run.defaultDatasetId REAL. Sin corte, re-correr el backfill vuelve
// a insertar las MISMAS observaciones bajo el dataset real → doble conteo que sesga la curva de
// crecimiento de reels jóvenes (M1-bis). El corte separa las dos épocas: antes del motor lo copia el
// backfill; desde el motor lo escribe el motor.
//
// Se compara run.startedAt < corte (el mismo campo que da `medido_en`). `startedAt >= corte` se
// salta. Sin corte (null), se copia todo: es el comportamiento anterior, para el primer backfill.
//
// ⚠️ Un corte NO-null pero ILEGIBLE es un error, no "copiá todo": antes esta función devolvía la
// lista entera sin filtrar, lo que hacía que un --corte mal tipeado re-insertara la época del motor
// (doble conteo M1-bis) en silencio. Ahora TIRA: quien resuelve el corte (resolverCorte) es el que
// decide si un corte ausente es legítimo (sinCorte) o un fallo (error). Acá un corte presente que no
// parsea siempre es un bug.
//
// ponytail: el techo es que el corte es un único instante global; si mañana hubiera varias
// instancias arrancando el motor en fechas distintas, el corte tendría que ser por instancia. Hoy
// hay una sola instancia `reels`, así que un corte global alcanza. Upgrade path: pasar el corte a
// un Map<instance_id, corte> y filtrar por la instancia del run cuando el manifest lo exponga.
export function runsHastaCorte(runs, corte) {
  const lista = Array.isArray(runs) ? runs : [];
  if (!corte) return { copiar: lista, saltadas: 0 };
  const t = Date.parse(corte);
  if (!Number.isFinite(t)) {
    throw new Error(`Corte ilegible (no es fecha ISO): ${JSON.stringify(corte)}`);
  }
  const copiar = [];
  let saltadas = 0;
  for (const run of lista) {
    const ini = Date.parse(run && run.startedAt);
    if (Number.isFinite(ini) && ini >= t) saltadas++;
    else copiar.push(run);
  }
  return { copiar, saltadas };
}

// ── resolverCorte: la decisión PURA de qué instante de corte usar (unit-testable, sin red) ──
// Recibe lo ya leído por la red y devuelve exactamente uno de:
//   { corte }        → hay un instante confiable (ISO); runsHastaCorte filtra por él
//   { sinCorte: true } → NO hay filas del motor: primer backfill legítimo, copia todo
//   { error }        → algo salió mal y copiar todo sería un doble conteo silencioso: se BLOQUEA
//
// Entradas:
//   flag         : valor de --corte (ISO) o null/undefined
//   filaMotor    : la primera fila origen='motor' ({ run_id, medido_en }) o null si no hay ninguna
//   inicioRun    : runs.inicio del run_id de esa fila (ISO) o null si no se pudo resolver
//   errorLectura : true si alguno de los GET falló / vino con forma inesperada
//
// 🩸 El corte se deriva del ARRANQUE del motor (runs.inicio), NO de cuándo escribió (medido_en). El
// nodo 'Preparar pool crudo' estampa medido_en DESPUÉS de que Apify terminó; el Apify run de esa
// misma corrida arrancó minutos/una hora ANTES. Usar medido_en dejaba startedAt < corte justo para
// los runs que el motor YA escribió, y el backfill los re-insertaba bajo el dataset real (doble
// conteo en la PRIMERA corrida del motor). El propio run del motor es un Apify run arrancado después
// de inicio, así que `>= inicio` lo captura bien.
export function resolverCorte({ flag, filaMotor, inicioRun, errorLectura } = {}) {
  // 1) --corte manual gana, pero tiene que parsear. Ilegible = error (no "copiá todo").
  if (flag) {
    const t = Date.parse(flag);
    if (!Number.isFinite(t)) {
      return { error: `--corte ilegible (no es fecha ISO): ${JSON.stringify(flag)}` };
    }
    return { corte: flag };
  }
  // 2) Si la lectura de los datos falló, NO inventamos un corte ni copiamos todo: se bloquea.
  if (errorLectura) {
    return { error: 'no se pudo leer el corte del motor (GET falló o vino con forma inesperada)' };
  }
  // 3) Sin filas del motor: primer backfill legítimo, copia todo.
  if (!filaMotor) {
    return { sinCorte: true };
  }
  // 4) Hay fila del motor pero sin run_id (registro caído esa corrida) → no hay instante confiable.
  if (!filaMotor.run_id) {
    return { error: "fila del motor sin run_id: no hay arranque confiable, pasá --corte <ISO>" };
  }
  // 5) run_id presente pero el lookup de runs.inicio no devolvió nada.
  if (!inicioRun) {
    return { error: `no se encontró runs.inicio para run_id=${filaMotor.run_id}` };
  }
  // 6) inicioRun tiene que parsear.
  if (!Number.isFinite(Date.parse(inicioRun))) {
    return { error: `runs.inicio ilegible: ${JSON.stringify(inicioRun)}` };
  }
  return { corte: inicioRun };
}

// ── Apify: listar TODOS los actor-runs conservados (pagina de a 200) ──
async function listarRuns() {
  const runs = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const d = await getJson(`${APIFY}/actor-runs?token=${APIFY_TOKEN}&limit=200&offset=${offset}&desc=1`);
    const items = (d && d.data && d.data.items) || [];
    runs.push(...items);
    if (items.length < 200) break;
  }
  return runs;
}

// Items de un dataset (GRATIS). `clean=1` quita metadatos internos; `fields` acota el payload.
async function itemsDelDataset(datasetId) {
  const fields = 'id,shortCode,shortcode,type,ownerUsername,videoViewCount,videoPlayCount,igPlayCount,' +
                 'likesCount,commentsCount,followersCount,ownerFollowersCount,metaData,videoDuration,timestamp,url,error';
  const url = `${APIFY}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=1&fields=${fields}&limit=10000`;
  const d = await getJson(url);
  // `null` y no `[]` cuando no se pudo leer: un 429 o un dataset ya vencido NO es un dataset vacío,
  // y confundirlos haría que el backfill termine en verde habiendo perdido historia pagada.
  return Array.isArray(d) ? d : null;
}

// ── El corte tomado de los DATOS: el ARRANQUE (runs.inicio) del primer run del motor ──
// Dos GET, sin costo:
//   1) primera fila origen='motor' (perfil `app`): select=run_id,medido_en&order=medido_en.asc&limit=1
//   2) runs.inicio de ese run_id (schema public, PostgREST lo expone en el perfil por defecto).
// Devuelve { filaMotor, inicioRun, errorLectura } — insumos crudos para resolverCorte (pura). NO
// decide acá: quién bloquea y quién copia-todo lo decide resolverCorte, testeable sin red.
//
// Se lee runs.inicio (arranque) y NO medido_en (escritura): ver el comentario de resolverCorte.
// getJson devuelve null tanto en error (non-2xx / parse fail) como —para estos endpoints— nunca en
// "0 filas" (eso es `[]`). Por eso: null aquí = error de lectura; `[]` = no hay filas del motor.
async function leerCorteDesdeDatos() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    // Sin credenciales no podemos leer: en dry-run esto es un no-op (se avisa), no un corte falso.
    return { filaMotor: null, inicioRun: null, errorLectura: true };
  }
  const headMotor = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Accept-Profile': 'app',
  };
  const urlMotor = `${SUPABASE_URL}/rest/v1/pool_crudo?select=run_id,medido_en&origen=eq.motor&order=medido_en.asc&limit=1`;
  const dMotor = await getJson(urlMotor, headMotor);
  if (!Array.isArray(dMotor)) {
    // null = GET falló o vino con forma inesperada. NO es "no hay filas".
    return { filaMotor: null, inicioRun: null, errorLectura: true };
  }
  if (dMotor.length === 0) {
    // Sin filas del motor: primer backfill legítimo. No es error.
    return { filaMotor: null, inicioRun: null, errorLectura: false };
  }
  const filaMotor = { run_id: dMotor[0].run_id ?? null, medido_en: dMotor[0].medido_en ?? null };
  if (!filaMotor.run_id) {
    // Fila del motor sin run_id: resolverCorte lo trata como error (pedir --corte).
    return { filaMotor, inicioRun: null, errorLectura: false };
  }
  // Lookup del arranque en public.runs (sin Accept-Profile: schema public por defecto).
  const urlRun = `${SUPABASE_URL}/rest/v1/runs?select=inicio&id=eq.${encodeURIComponent(filaMotor.run_id)}`;
  const dRun = await getJson(urlRun, {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
  });
  if (!Array.isArray(dRun)) {
    return { filaMotor, inicioRun: null, errorLectura: true };
  }
  const inicioRun = dRun.length >= 1 && dRun[0].inicio ? dRun[0].inicio : null;
  return { filaMotor, inicioRun, errorLectura: false };
}

// ── PostgREST: resolver la instancia de reels, y hacer el UPSERT idempotente ──
async function resolverInstanceReels() {
  const url = `${SUPABASE_URL}/rest/v1/instances?select=id,slug&slug=eq.reels&limit=1`;
  const d = await getJson(url, {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
  });
  // Fail-closed, sin fallback: prod tiene 3 instancias `linkedin` además de `reels`, así que "la
  // primera" podía ser una de LinkedIn y el pool de reels quedaba escrito en el cockpit equivocado.
  // Si hubiera más de un `reels` (otra empresa), esto también tiene que pararse y preguntar.
  if (Array.isArray(d) && d.length === 1 && d[0].id) return d[0].id;
  return null;
}

// UPSERT por lotes contra pool_crudo_dataset_idx. `resolution=merge-duplicates` + on_conflict hace
// que re-correr no duplique (ADR-099).
async function upsertLote(instanceId, filas) {
  const cols = 'instance_id,plataforma,external_id,apify_dataset_id';
  const url = `${SUPABASE_URL}/rest/v1/pool_crudo?on_conflict=${cols}`;
  const cuerpo = filas.map((f) => ({ ...f, instance_id: instanceId }));
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Profile': 'app',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`PostgREST ${r.status} en el upsert — ${txt.slice(0, 300)}`);
  }
}

// ── Main ──
async function main() {
  exigirEntorno();
  console.log(`\n=== backfill-pool-crudo — ${APPLY ? '🔴 APPLY (escribe)' : 'DRY-RUN (no escribe)'} ===\n`);

  const runs = await listarRuns();
  const reelRuns = runs.filter(esRunDeReels);

  // Corte por arranque del motor: --corte gana; si no, se lee de los datos (runs.inicio del primer
  // run del motor). La DECISIÓN (corte / sinCorte / error) la toma resolverCorte, pura y testeable.
  const { filaMotor, inicioRun, errorLectura } = CORTE_FLAG
    ? { filaMotor: null, inicioRun: null, errorLectura: false }   // con --corte no hace falta leer
    : await leerCorteDesdeDatos();
  const dec = resolverCorte({ flag: CORTE_FLAG, filaMotor, inicioRun, errorLectura });

  // Un corte que no se pudo resolver NO puede degradar a "copiá todo": eso re-inserta la época del
  // motor (doble conteo M1-bis). Dry-run avisa fuerte; --apply se rehúsa antes de escribir (mismo
  // mecanismo de guarda que el dataset ilegible).
  if (dec.error) {
    console.log(`\n⚠️  No se pudo determinar un corte confiable: ${dec.error}.`);
    console.log('⚠️  Copiar todo re-insertaría la época del motor (doble conteo M1-bis). Pasá un corte explícito:');
    console.log('⚠️      node backfill-pool-crudo.mjs --corte <ISO>   (p.ej. --corte 2026-09-15T00:00:00Z)');
    if (APPLY) {
      console.error('\n❌ Con --apply no se escribe nada hasta tener un corte confiable (ver arriba).');
      process.exit(1);
    }
    console.log('\nDRY-RUN: no se escribió nada. Resolvé el corte antes de correr con --apply.\n');
    return;
  }

  const corte = dec.sinCorte ? null : dec.corte;
  const { copiar: reelRunsACopiar, saltadas } = runsHastaCorte(reelRuns, corte);
  console.log(`Runs conservados por Apify: ${runs.length} · del actor de reels (${ACTOR_SLUG}), con dataset: ${reelRuns.length}`);
  console.log(`Corte motor: ${corte || '— (sin corte: copia todo)'}${CORTE_FLAG ? ' [--corte]' : ''} · saltadas por corte motor: ${saltadas}`);

  // Recolectar todas las observaciones, deduplicando por la clave de idempotencia en memoria (para
  // no mandar dos veces la misma en un solo backfill).
  const porClave = new Map();          // instance|plat|ext|dataset -> fila
  const porDia = new Map();            // YYYY-MM-DD -> Set(external_id)
  const reelsUnicos = new Set();
  const cuentas = new Set();
  let itemsVistos = 0;
  const expiries = [];                 // fechas de borrado estimadas (medido_en + 31 días)
  const sinLeer = [];                  // datasets que Apify no devolvió (429, vencido, red)

  for (const run of reelRunsACopiar) {
    const datasetId = run.defaultDatasetId;
    const medido_en = fechaISO(run.startedAt) || fechaISO(run.finishedAt);
    const items = await itemsDelDataset(datasetId);
    if (items === null) {
      sinLeer.push(`${datasetId} (${(medido_en || '').slice(0, 10)})`);
      continue;
    }
    itemsVistos += items.length;

    for (const item of items) {
      const fila = normalizarItem(item, {
        medido_en,
        apify_run_id: run.id,
        apify_dataset_id: datasetId,
        origen: 'backfill',
      });
      if (!fila) continue;

      const clave = `instagram|${fila.external_id}|${datasetId}`;
      if (!porClave.has(clave)) porClave.set(clave, fila);

      reelsUnicos.add(fila.external_id);
      if (fila.handle) cuentas.add(fila.handle);
      const dia = (medido_en || '').slice(0, 10);
      if (dia) {
        if (!porDia.has(dia)) porDia.set(dia, new Set());
        porDia.get(dia).add(fila.external_id);
      }
    }
    if (medido_en) {
      const exp = new Date(Date.parse(medido_en) + 31 * 86400000);
      expiries.push(exp);
    }
  }

  const filas = [...porClave.values()];
  const dias = [...porDia.keys()].sort();
  const expiriesOrd = expiries.sort((a, b) => a - b);
  const primerVencimiento = expiriesOrd[0];

  // ── Reporte ──
  console.log('\n── Por día (fecha de medición: reels únicos) ──');
  for (const dia of dias) console.log(`  ${dia}: ${porDia.get(dia).size}`);

  console.log('\n── Totales ──');
  console.log(`  items crudos leídos:        ${itemsVistos}`);
  console.log(`  filas a escribir (obs.):    ${filas.length}`);
  console.log(`  reels únicos:               ${reelsUnicos.size}`);
  console.log(`  cuentas (handles):          ${cuentas.size}`);
  console.log(`  saltadas por corte motor:   ${saltadas}`);
  console.log(`  rango de fechas:            ${dias[0] || '—'} → ${dias[dias.length - 1] || '—'}`);
  console.log(`  primer dataset que vence:   ${primerVencimiento ? primerVencimiento.toISOString().slice(0, 10) : '—'}`);
  console.log(`  datasets SIN LEER:          ${sinLeer.length}`);
  if (sinLeer.length) {
    console.log('\n⚠️ Estos datasets no se pudieron leer (429, vencidos o red). NO son vacíos:');
    for (const s of sinLeer.slice(0, 20)) console.log(`  ${s}`);
    if (sinLeer.length > 20) console.log(`  … y ${sinLeer.length - 20} más`);
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN: no se escribió nada. Corré con --apply ANTES de que venza el primero (${primerVencimiento ? primerVencimiento.toISOString().slice(0, 10) : '—'}).\n`);
    return;
  }
  // Con --apply, un dataset sin leer frena ANTES de escribir: re-correr es idempotente, así que lo
  // honesto es reintentar hasta que lea todo, no terminar en verde con historia perdida.
  if (sinLeer.length) {
    console.error(`\n❌ ${sinLeer.length} dataset(s) sin leer: no se escribe nada. Reintentá en unos minutos.`);
    process.exit(1);
  }

  // ── APPLY ──
  const instanceId = await resolverInstanceReels();
  if (!instanceId) { console.error('No se pudo resolver la instancia de reels.'); process.exit(1); }
  console.log(`\nEscribiendo a app.pool_crudo (instancia ${instanceId})…`);

  const LOTE = 500;
  let escritas = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await upsertLote(instanceId, lote);
    escritas += lote.length;
    console.log(`  … ${escritas}/${filas.length}`);
  }
  console.log(`\n✅ Upsert de ${escritas} observaciones (idempotente). Verificá por efecto:`);
  console.log(`   select count(*) from app.pool_crudo;`);
  console.log(`   select count(*) from app.v_watermark_referentes;\n`);
}

// Solo corre si se invoca directo (el test importa las funciones sin ejecutar main).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
