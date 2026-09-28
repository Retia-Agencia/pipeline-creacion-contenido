#!/usr/bin/env node
// sonda-virlo.mjs — Fase 0 de docs/agents/plan-migracion-virlo.md: medir Virlo con plata real ANTES
// de tocar el pipeline. No escribe una sola fila en Supabase; solo lee `app.referentes` y
// `app.pool_crudo` para comparar, y guarda las respuestas crudas de Virlo como fixtures.
//
//   set -a && source .env && set +a && node Workflows/workflow-short-form-content/sonda-virlo.mjs <modo> [flags]
//
//   lookup [--handles a,b,c] [--max 100] [--apply]
//        Creator lookup de Instagram (0,50 USD por handle). Sin --handles toma 3 referentes IG
//        activos de app.referentes. Sin --apply solo dice qué pediría y cuánto costaría.
//        Contesta: ¿qué es `id` (media id numérico, shortcode, uuid)? ¿cuántos días hacia atrás
//        llega? ¿viene `duration`? ¿las vistas coinciden con pool_crudo para el mismo reel?
//   agent --intent "…" --keywords "a;b;c" [--di] [--apply]
//        Crea un agent de una sola corrida (0,50 USD; 1,50 con --di = Data Intelligence), con
//        english_only=false (el default de Virlo es true y nosotros buscamos en todos los idiomas).
//        Espera a `finalized` y baja todos los videos.
//   leer-agent <agent_id>
//        Baja los videos de un agent ya corrido. Leer es gratis.
//
// 🔑 Lo que decide la Fase 5 (transcripts): en la llamada del 28/09 Virlo dijo que con Data
// Intelligence entrega el transcript; la doc pública no muestra ningún campo con el texto. Esta
// sonda busca en TODA la respuesta cualquier clave que contenga "transcript" y diga si trae texto
// o solo conteos. Hasta que eso dé texto, Supadata no se toca.
//
// Fail-open: Virlo no cobra los errores, y cualquier forma de respuesta inesperada se guarda cruda
// en fixtures/virlo/ para mirarla a mano, en vez de adivinar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { VIRLO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
const BASE = 'https://api.virlo.ai/v1';
const DIR_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'virlo');
const USD_LOOKUP = 0.5;
const USD_AGENT = 0.5;
const USD_AGENT_DI = 1.5;
// Creator lookup: 5 por minuto (docs/rate-limits). 13 s entre arranques deja margen.
const ESPACIO_LOOKUP_MS = 13_000;
const ESPERA_MAX_MS = 25 * 60_000; // agents: 9 de cada 10 terminan en <20 min (docs/agents)

const args = process.argv.slice(2);
const modo = args[0];
const flag = (n) => args.includes('--' + n);
const valor = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const APPLY = flag('apply');

if (!['lookup', 'agent', 'leer-agent'].includes(modo)) {
  console.error('Uso: sonda-virlo.mjs lookup|agent|leer-agent [flags]  (ver cabecera del archivo)');
  process.exit(1);
}
if (!VIRLO_API_KEY && (APPLY || modo === 'leer-agent')) {
  console.error('Falta VIRLO_API_KEY en el .env (formato virlo_tkn_…, dev.virlo.ai/dashboard/api-keys).');
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let gastado = 0;

async function virlo(metodo, ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${VIRLO_API_KEY}`,
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  // X-Cost viene en créditos (1 crédito = 0,01 USD) según docs/credits.
  const costo = Number(r.headers.get('x-cost') ?? 0);
  if (costo) gastado += costo / 100;
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* se devuelve el texto crudo */ }
  if (!r.ok) {
    const e = new Error(`${metodo} ${ruta} → ${r.status} ${texto.slice(0, 300)}`);
    e.status = r.status;
    throw e;
  }
  return json ?? texto;
}

function guardar(nombre, datos) {
  mkdirSync(DIR_FIXTURES, { recursive: true });
  const archivo = join(DIR_FIXTURES, nombre);
  writeFileSync(archivo, JSON.stringify(datos, null, 2));
  console.log(`   💾 ${archivo}`);
}

// Recorre la respuesta entera buscando claves con "transcript". Distingue texto de conteo, que es
// justamente la duda entre la llamada y la doc.
function rastrearTranscripts(obj, ruta = '', hallados = []) {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const aqui = ruta ? `${ruta}.${k}` : k;
      if (/transcri|caption|subtit|speech/i.test(k)) {
        const tipo = typeof v === 'string' ? (v.length > 40 ? 'TEXTO' : 'string corto')
          : Array.isArray(v) ? `array(${v.length})` : typeof v;
        hallados.push({ ruta: aqui.replace(/\.\d+\./g, '[].'), tipo, muestra: typeof v === 'string' ? v.slice(0, 80) : v });
      }
      rastrearTranscripts(v, aqui, hallados);
    }
  }
  return hallados;
}

function resumenTranscripts(respuesta) {
  const hallados = rastrearTranscripts(respuesta);
  const porRuta = new Map();
  for (const h of hallados) {
    const x = porRuta.get(h.ruta) ?? { tipo: h.tipo, n: 0, muestra: h.muestra };
    x.n++;
    if (h.tipo === 'TEXTO') { x.tipo = 'TEXTO'; x.muestra = h.muestra; }
    porRuta.set(h.ruta, x);
  }
  console.log('\n🔎 Claves con transcript/caption/subtítulo/speech:');
  if (!porRuta.size) console.log('   (ninguna)');
  for (const [ruta, x] of porRuta) console.log(`   ${x.tipo.padEnd(12)} ×${x.n}  ${ruta}  ${JSON.stringify(x.muestra).slice(0, 90)}`);
  const hayTexto = [...porRuta.values()].some((x) => x.tipo === 'TEXTO');
  console.log(hayTexto
    ? '   ✅ HAY texto de transcript: la Fase 5 es viable. Mirar si trae segmentos con tiempos (ADR-095).'
    : '   ⛔ NO hay texto de transcript: Supadata se queda. Preguntar a Virlo por el endpoint.');
}

// Encuentra el array de videos sin asumir el envoltorio exacto (`data.videos`, `data.run.videos`…).
function videosDe(resp) {
  let mejor = [];
  (function buscar(o) {
    if (Array.isArray(o)) {
      if (o.length > mejor.length && o.every((x) => x && typeof x === 'object' && ('views' in x || 'url' in x))) mejor = o;
      o.forEach(buscar);
    } else if (o && typeof o === 'object') Object.values(o).forEach(buscar);
  })(resp);
  return mejor;
}

// Mismo alfabeto que apps/dashboard/domain/enlace.ts shortcodeAExternalId: de ese id numérico
// dependen processed_items, la caché de transcripts y videos_meta.
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function shortcodeAExternalId(sc) {
  let n = 0n;
  for (const c of sc) { const i = ALFABETO.indexOf(c); if (i < 0) return ''; n = n * 64n + BigInt(i); }
  return n.toString();
}
const shortcodeDeUrl = (u) => (String(u ?? '').match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/) ?? [])[1] ?? null;

function clasificarId(id) {
  const s = String(id ?? '');
  if (/^\d{15,}(_\d+)?$/.test(s)) return 'media id numérico de IG';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return 'uuid de Virlo (hay que derivar el id de la url)';
  if (/^[A-Za-z0-9_-]{9,14}$/.test(s)) return 'shortcode';
  return `otro (${s.slice(0, 20)})`;
}

async function supabase(ruta) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`, 'Accept-Profile': 'app' },
  });
  return r.ok ? r.json() : null;
}

// ═══════════════════════════════════════ lookup ═══════════════════════════════════════
async function modoLookup() {
  const max = Number(valor('max', 100));
  let handles = valor('handles', null)?.split(',').map((h) => h.trim().replace(/^@/, '')).filter(Boolean);
  if (!handles?.length) {
    const filas = await supabase('referentes?select=handle&plataforma=eq.instagram&activo=is.true&limit=3');
    handles = (filas ?? []).map((f) => f.handle.replace(/^@/, ''));
  }
  if (!handles.length) { console.error('No hay handles: pasá --handles a,b,c o cargá el .env de Supabase.'); process.exit(1); }

  console.log(`Lookup IG de ${handles.length} referentes (${handles.join(', ')}), max_videos=${max}`);
  console.log(`Costo estimado: ${(handles.length * USD_LOOKUP).toFixed(2)} USD (gratis si se repite <6 h con las mismas opciones)`);
  if (!APPLY) { console.log('\nDry-run: agregá --apply para pagar y medir.'); return; }

  for (const [i, h] of handles.entries()) {
    if (i) await dormir(ESPACIO_LOOKUP_MS);
    console.log(`\n── @${h}`);
    let arranque;
    try {
      arranque = await virlo('GET', `/satellite/creator/instagram/${encodeURIComponent(h)}?include=videos&max_videos=${max}`);
    } catch (e) { console.log(`   ✗ ${e.message}`); continue; }
    const jobId = arranque?.data?.job_id ?? arranque?.data?.id ?? arranque?.job_id;
    let estado = arranque;
    const t0 = Date.now();
    while (jobId && Date.now() - t0 < 10 * 60_000) {
      const st = String(estado?.data?.status ?? '').toLowerCase();
      if (['completed', 'failed'].includes(st)) break;
      await dormir(1000 * Number(estado?.data?.retry_after_seconds ?? 15));
      estado = await virlo('GET', `/satellite/creator/status/${jobId}`);
    }
    const segundos = Math.round((Date.now() - t0) / 1000);
    let completo = estado;
    let videos = videosDe(completo);
    const runId = estado?.data?.run_id ?? estado?.data?.run?.id;
    if (!videos.length && runId) {
      completo = { estado, videos: await virlo('GET', `/satellite/runs/${runId}/videos?limit=100`) };
      videos = videosDe(completo);
    }
    guardar(`lookup-${h}.json`, completo);
    await analizarVideosLookup(h, videos, segundos);
    resumenTranscripts(completo);
  }
}

async function analizarVideosLookup(handle, videos, segundos) {
  console.log(`   ${videos.length} videos en ${segundos} s`);
  if (!videos.length) return;
  const v0 = videos[0];
  console.log(`   id → ${clasificarId(v0.id)}  (ej. ${v0.id})`);
  console.log(`   claves: ${Object.keys(v0).join(', ')}`);
  const fechas = videos.map((v) => Date.parse(v.publish_date)).filter(Number.isFinite).sort((a, b) => a - b);
  if (fechas.length) {
    const dias = (Date.now() - fechas[0]) / 86_400_000;
    console.log(`   alcance: ${new Date(fechas[0]).toISOString().slice(0, 10)} → ${new Date(fechas.at(-1)).toISOString().slice(0, 10)} (${dias.toFixed(0)} días hacia atrás)`);
  }
  const conDur = videos.filter((v) => Number(v.duration) > 0).length;
  const reels = videos.filter((v) => v.is_video !== false && Number(v.views) > 0).length;
  console.log(`   con duration: ${conDur}/${videos.length} · con vistas (reels): ${reels}/${videos.length}`);

  // Mismo reel, dos proveedores: vistas de Virlo contra la última medición de Apify en pool_crudo.
  const porId = new Map();
  for (const v of videos) {
    const sc = shortcodeDeUrl(v.url);
    const eid = /^\d{15,}/.test(String(v.id)) ? String(v.id).split('_')[0] : sc ? shortcodeAExternalId(sc) : null;
    if (eid) porId.set(eid, v);
  }
  if (!porId.size) { console.log('   ⚠️ no pude derivar el media id de IG de ningún video'); return; }
  const ids = [...porId.keys()].slice(0, 100);
  const filas = await supabase(`pool_crudo?select=external_id,vistas,medido_en&plataforma=eq.instagram&external_id=in.(${ids.join(',')})&order=medido_en.desc`);
  if (!filas) { console.log('   (sin .env de Supabase: no comparo con pool_crudo)'); return; }
  const ultima = new Map();
  for (const f of filas) if (!ultima.has(f.external_id)) ultima.set(f.external_id, f);
  const pares = [...ultima.values()].map((f) => ({ ...f, virlo: Number(porId.get(f.external_id).views) }));
  console.log(`   en pool_crudo (Apify) también: ${pares.length}/${porId.size}`);
  for (const p of pares.slice(0, 5)) {
    const dif = p.vistas ? ((p.virlo - p.vistas) / p.vistas * 100).toFixed(1) : '—';
    console.log(`     ${p.external_id}  apify ${p.vistas} (${p.medido_en.slice(0, 10)})  virlo ${p.virlo}  Δ ${dif}%`);
  }
}

// ═══════════════════════════════════════ agent ═══════════════════════════════════════
async function modoAgent() {
  const intent = valor('intent', null);
  const keywords = valor('keywords', '').split(';').map((k) => k.trim()).filter(Boolean);
  const di = flag('di');
  if (!intent || !keywords.length) { console.error('Faltan --intent "…" y --keywords "a;b;c".'); process.exit(1); }
  const cuerpo = {
    is_recurring: false,
    name: `sonda ${new Date().toISOString().slice(0, 10)}`,
    intent,
    keywords,
    platforms: ['instagram', 'tiktok'],
    english_only: false,
    data_intelligence_enabled: di,
  };
  console.log('Agent de una corrida:\n' + JSON.stringify(cuerpo, null, 2));
  console.log(`Costo estimado: ${(di ? USD_AGENT_DI : USD_AGENT).toFixed(2)} USD`);
  if (!APPLY) { console.log('\nDry-run: agregá --apply para pagar y medir.'); return; }

  const creado = await virlo('POST', '/agents', cuerpo);
  const id = creado?.data?.id;
  console.log(`   agent ${id} creado, esperando finalized…`);
  const t0 = Date.now();
  let agente = creado;
  while (Date.now() - t0 < ESPERA_MAX_MS) {
    await dormir(1000 * Number(agente?.data?.retry_after_seconds ?? 15));
    agente = await virlo('GET', `/agents/${id}`);
    if (agente?.data?.finalized) break;
    process.stdout.write(`   ${Math.round((Date.now() - t0) / 1000)} s · ${agente?.data?.latest_run?.status ?? '?'}\r`);
  }
  console.log(`\n   finalized=${agente?.data?.finalized} en ${Math.round((Date.now() - t0) / 60000)} min`);
  guardar(`agent-${id}.json`, agente);
  if (di) console.log('   ⚠️ Data Intelligence sigue llegando después de finalized: re-leé en unos minutos con leer-agent.');
  await modoLeerAgent(id);
}

async function modoLeerAgent(id) {
  const videos = [];
  for (let offset = 0; ; offset += 100) {
    const pag = await virlo('GET', `/agents/${id}/videos?limit=100&offset=${offset}`);
    const lote = pag?.data?.videos ?? videosDe(pag);
    videos.push(...lote);
    if (lote.length < 100) break;
  }
  guardar(`agent-${id}-videos.json`, videos);
  const piso = Number(valor('min-views', 400_000));
  const porPlat = {};
  for (const v of videos) porPlat[v.platform] = (porPlat[v.platform] ?? 0) + 1;
  const sobre = videos.filter((v) => Number(v.views) >= piso);
  const match = sobre.filter((v) => v.intent_match !== false && v.matched_intent !== false);
  console.log(`\n${videos.length} videos · por plataforma ${JSON.stringify(porPlat)}`);
  console.log(`≥ ${piso.toLocaleString('es')} vistas: ${sobre.length} · y además con match de intent: ${match.length}`);
  if (videos[0]) console.log(`claves de un video: ${Object.keys(videos[0]).join(', ')}`);
  resumenTranscripts(videos);
}

try {
  if (modo === 'lookup') await modoLookup();
  else if (modo === 'agent') await modoAgent();
  else await modoLeerAgent(args[1]);
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (gastado) console.log(`\n💸 Gastado según X-Cost: ${gastado.toFixed(2)} USD`);
}
