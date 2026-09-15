#!/usr/bin/env node
// test-backfill-pool-crudo.mjs — ejercita el normalizador y la clave de idempotencia SIN red.
//
//   node core/scripts/test-backfill-pool-crudo.mjs
//   npm run test:pool     (alias)
//
// Por qué existe: el backfill copia datasets que Apify borra a los 31 días, así que un bug en la
// normalización (un campo mal mapeado, un pinned post contado como nuevo) se descubriría cuando ya
// no hay con qué re-medir. Esto fija la semántica que importa, sin gastar un GET.
//
// Estilo: mismo `check` de Workflows/workflow-short-form-content/test-nodos.mjs. Sin deps.

import { normalizarItem, normalizarHandle, esRunDeReels } from './backfill-pool-crudo.mjs';

let fail = 0;
const check = (nombre, cond, detalle) => {
  console.log((cond ? '✅' : '❌') + ' ' + nombre + (cond ? '' : '\n     → ' + detalle));
  if (!cond) fail++;
};
const seccion = (t) => console.log('\n── ' + t);

// ════════════════════════════════════════════════════════════════════════════
// normalizarItem — la MISMA cadena de `Normalizar IG` del motor
// ════════════════════════════════════════════════════════════════════════════
seccion('normalizarItem — cadena de campos del motor');

// El caso normal medido: videoViewCount viene null, las vistas están en videoPlayCount (apify.ts).
const normal = normalizarItem({
  id: '3533826375939613252',
  shortCode: 'DEKrF2ryWJE',
  type: 'Video',
  ownerUsername: '@Vieira_Trading',
  videoViewCount: null,
  videoPlayCount: 44210,
  likesCount: 1200,
  commentsCount: 33,
  followersCount: 55000,
  videoDuration: 42.5,
  timestamp: '2026-09-01T10:00:00.000Z',
  url: 'https://www.instagram.com/reel/DEKrF2ryWJE/',
}, { medido_en: '2026-09-07T12:00:00.000Z', apify_dataset_id: 'ds1', apify_run_id: 'run1' });

check('external_id sale de item.id primero',
  normal.external_id === '3533826375939613252', JSON.stringify(normal));
check('vistas caen a videoPlayCount cuando videoViewCount es null',
  normal.vistas === 44210, `vistas=${normal.vistas}`);
check('handle se normaliza (sin @, minúsculas)',
  normal.handle === 'vieira_trading', `handle=${normal.handle}`);
check('publicado_en se parsea a ISO',
  normal.publicado_en === '2026-09-01T10:00:00.000Z', `publicado_en=${normal.publicado_en}`);
check('medido_en viene del contexto (run.startedAt)',
  normal.medido_en === '2026-09-07T12:00:00.000Z', `medido_en=${normal.medido_en}`);
check('origen default = backfill',
  normal.origen === 'backfill', `origen=${normal.origen}`);
check('run_id nullable (dataset viejo no cruza corrida)',
  normal.run_id === null, `run_id=${normal.run_id}`);

// videoViewCount presente gana (respeta el orden || del motor, aunque en prod venga null).
const conView = normalizarItem({ id: 'x', type: 'Video', videoViewCount: 999, videoPlayCount: 111, url: 'u' }, {});
check('videoViewCount gana si viene (orden del motor)', conView.vistas === 999, `vistas=${conView.vistas}`);

// seguidores: cadena de fallback followersCount → ownerFollowersCount → metaData.followersCount
const segA = normalizarItem({ id: 'a', type: 'Video', ownerFollowersCount: 7000, url: 'u' }, {});
check('seguidores caen a ownerFollowersCount', segA.seguidores === 7000, `seg=${segA.seguidores}`);
const segB = normalizarItem({ id: 'b', type: 'Video', metaData: { followersCount: 8000 }, url: 'u' }, {});
check('seguidores caen a metaData.followersCount', segB.seguidores === 8000, `seg=${segB.seguidores}`);

// nulls: un scrape a medias guarda null, no 0 (un cero mentiría).
const parcial = normalizarItem({ id: 'p', type: 'Video', url: 'u' }, {});
check('campos ausentes son null, no 0', parcial.vistas === null && parcial.seguidores === null,
  JSON.stringify(parcial));

seccion('normalizarItem — descartes');
check('un {error} (rechazo del proveedor) se descarta',
  normalizarItem({ error: 'Forbidden' }, {}) === null);
check('una foto/carrusel (type != Video) se descarta',
  normalizarItem({ id: 'z', type: 'Image', url: 'u' }, {}) === null);
check('un item sin id ni url se descarta',
  normalizarItem({ type: 'Video' }, {}) === null);
check('un item con url pero sin id se descarta (sin identidad estable)',
  normalizarItem({ type: 'Video', url: 'u' }, {}) === null);
check('null/no-objeto se descarta',
  normalizarItem(null) === null && normalizarItem('foo') === null);

// El pinned post: viene con timestamp viejísimo (§4.3.5). Se NORMALIZA igual (es un reel real); la
// robustez a pins vive en el max() de la vista de watermark, no acá. Lo que se fija es que su
// publicado_en viejo se conserve tal cual, para que la exclusión aguas abajo lo pueda ver.
seccion('normalizarItem — post fijado (pinned)');
const pin = normalizarItem({
  id: 'pinned1', type: 'Video', ownerUsername: 'cuenta', videoPlayCount: 5,
  timestamp: '2024-01-01T00:00:00.000Z', url: 'u',
}, { medido_en: '2026-09-07T00:00:00.000Z' });
check('el pin conserva su publicado_en viejo (para excluirlo aguas abajo)',
  pin.publicado_en === '2024-01-01T00:00:00.000Z', `publicado_en=${pin.publicado_en}`);

// ════════════════════════════════════════════════════════════════════════════
// La clave de idempotencia — (instance, plataforma, external_id, apify_dataset_id)
// ════════════════════════════════════════════════════════════════════════════
seccion('idempotencia — la clave que hace el backfill re-corrible');

// Igual reel, MISMO dataset → misma observación → misma clave → upsert no duplica.
const claveDe = (f) => `instagram|${f.external_id}|${f.apify_dataset_id}`;
const obsA = normalizarItem({ id: 'r1', type: 'Video', videoPlayCount: 100, url: 'u' },
  { apify_dataset_id: 'ds1', medido_en: '2026-09-01T00:00:00Z' });
const obsAbis = normalizarItem({ id: 'r1', type: 'Video', videoPlayCount: 100, url: 'u' },
  { apify_dataset_id: 'ds1', medido_en: '2026-09-01T00:00:00Z' });
check('mismo reel + mismo dataset = misma clave (no duplica al re-correr)',
  claveDe(obsA) === claveDe(obsAbis), `${claveDe(obsA)} vs ${claveDe(obsAbis)}`);

// Igual reel, DISTINTO dataset (medido otro día) → observación distinta → clave distinta → se
// conservan las dos (la historia longitudinal de §1.3).
const obsB = normalizarItem({ id: 'r1', type: 'Video', videoPlayCount: 130, url: 'u' },
  { apify_dataset_id: 'ds2', medido_en: '2026-09-07T00:00:00Z' });
check('mismo reel en otro dataset = clave distinta (conserva la historia longitudinal)',
  claveDe(obsA) !== claveDe(obsB), `${claveDe(obsA)} vs ${claveDe(obsB)}`);
check('la segunda observación tiene vistas mayores (creció, §1.3)',
  obsB.vistas > obsA.vistas, `${obsA.vistas} → ${obsB.vistas}`);

// ════════════════════════════════════════════════════════════════════════════
// esRunDeReels — el filtro de qué corridas se copian
// ════════════════════════════════════════════════════════════════════════════
seccion('esRunDeReels — todo lo pagado del actor de reels, sin importar quién lo pidió');
const ACTOR = 'shu8hvrXbJbY3Eb9W';
check('un run exitoso del actor de reels, origen API, se copia',
  esRunDeReels({ status: 'SUCCEEDED', defaultDatasetId: 'd', actId: ACTOR, meta: { origin: 'API' } }) === true);
check('un run sin meta.origin (viejo) se acepta',
  esRunDeReels({ status: 'SUCCEEDED', defaultDatasetId: 'd', actId: ACTOR }) === true);
check('🩸 una sesión de agente (origin MCP) TAMBIÉN se copia: compró reels reales y saltearla es irreversible',
  esRunDeReels({ status: 'SUCCEEDED', defaultDatasetId: 'd', actId: ACTOR, meta: { origin: 'MCP' } }) === true);
check('otro actor (no reels) se salta',
  esRunDeReels({ status: 'SUCCEEDED', defaultDatasetId: 'd', actId: 'otroActor', meta: { origin: 'API' } }) === false);
check('🩸 un run abortado o con timeout se copia: lo que alcanzó a devolver se cobró',
  esRunDeReels({ status: 'TIMED-OUT', defaultDatasetId: 'd', actId: ACTOR }) === true);
check('un run sin dataset se salta',
  esRunDeReels({ status: 'SUCCEEDED', actId: ACTOR }) === false);

seccion('normalizarHandle');
check('quita @ y baja a minúsculas', normalizarHandle('@Vieira') === 'vieira');
check('trim de espacios', normalizarHandle('  Foo  ') === 'foo');
check('vacío → cadena vacía', normalizarHandle(null) === '');

// ── Resultado ──
console.log(`\n${fail === 0 ? '✅ TODO VERDE' : '❌ ' + fail + ' fallo(s)'}\n`);
process.exit(fail === 0 ? 0 : 1);
