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
  console.log(`Runs conservados por Apify: ${runs.length} · del actor de reels (${ACTOR_SLUG}), con dataset: ${reelRuns.length}`);

  // Recolectar todas las observaciones, deduplicando por la clave de idempotencia en memoria (para
  // no mandar dos veces la misma en un solo backfill).
  const porClave = new Map();          // instance|plat|ext|dataset -> fila
  const porDia = new Map();            // YYYY-MM-DD -> Set(external_id)
  const reelsUnicos = new Set();
  const cuentas = new Set();
  let itemsVistos = 0;
  const expiries = [];                 // fechas de borrado estimadas (medido_en + 31 días)
  const sinLeer = [];                  // datasets que Apify no devolvió (429, vencido, red)

  for (const run of reelRuns) {
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
