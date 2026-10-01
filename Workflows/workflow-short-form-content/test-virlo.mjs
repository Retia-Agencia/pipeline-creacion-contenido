#!/usr/bin/env node
// test-virlo.mjs — la forma que produce normalizar-virlo.mjs es la MISMA que produce `Normalizar IG`
// para el mismo reel. Si eso se cumple, Asignar, Pre-trim, Heat-score, Gate y Armar candidato no se
// enteran de qué proveedor compró el video (ADR-101 D3).
//
//   node Workflows/workflow-short-form-content/test-virlo.mjs
//
// ⚠️ Los videos de Virlo de acá son INVENTADOS desde la doc (28/09). Cuando la sonda deje fixtures
// reales en fixtures/virlo/, se reemplazan por esos.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortcodeAExternalId as delCockpit } from '../../apps/dashboard/domain/enlace.ts';
import { esVideoVirlo, externalIdVirlo, fechaUtc, filaPoolCrudoVirlo, normalizarVideoVirlo, shortcodeAExternalId } from './normalizar-virlo.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const w = JSON.parse(readFileSync(join(aqui, 'workflow.json'), 'utf8'));
let fail = 0;
const check = (nombre, ok, detalle = '') => {
  console.log(`${ok ? '✅' : '❌'} ${nombre}`);
  if (!ok) { fail++; if (detalle) console.log(`     → ${detalle}`); }
};

// El mismo reel, como lo devuelve cada proveedor.
const SHORTCODE = 'DVJbxxfCHZ2';
const MEDIA_ID = delCockpit(SHORTCODE);
const APIFY = {
  id: MEDIA_ID, shortCode: SHORTCODE, type: 'Video', url: `https://www.instagram.com/p/${SHORTCODE}/`,
  ownerUsername: 'cuentaa', ownerFullName: 'Cuenta A', followersCount: 120000, biography: 'bio de a',
  caption: 'El sesgo que te hace gastar de más', likesCount: 5000, commentsCount: 300,
  videoPlayCount: 800000, displayUrl: 'https://cdn/x.jpg', hashtags: ['psicologia', 'sesgos'],
  videoDuration: 42.5, timestamp: '2026-09-20T14:00:00.000Z',
};
const VIRLO = {
  id: '6f1c2d3e-0000-4000-8000-000000000000', title: '', description: 'El sesgo que te hace gastar de más',
  views: 800000, likes: 5000, comments: 300, publish_date: '2026-09-20T14:00:00',
  url: `https://www.instagram.com/p/${SHORTCODE}/`, hashtags: ['#psicologia', '#sesgos'],
  thumbnail_url: 'https://cdn/x.jpg', duration: 42.5, content_type: 'video', is_video: true,
};
const CREADOR = { username: 'cuentaa', nombre: 'Cuenta A', seguidores: 120000, bio: 'bio de a' };

const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const codigo = w.nodes.find((n) => n.name === 'Normalizar IG').parameters.jsCode;
const deApify = (await new AsyncFn('$input', '$', codigo)(
  { all: () => [{ json: APIFY }] },
  (n) => { throw new Error('nodo no mockeado: ' + n); },
))[0].json;
const deVirlo = normalizarVideoVirlo(VIRLO, CREADOR, 'instagram');

console.log('── misma forma interna que Normalizar IG');
check('mismas claves', JSON.stringify(Object.keys(deVirlo).sort()) === JSON.stringify(Object.keys(deApify).sort()),
  `apify ${Object.keys(deApify).sort()} · virlo ${Object.keys(deVirlo).sort()}`);
const distintos = Object.keys(deApify).filter((k) => String(deApify[k]) !== String(deVirlo[k]));
// `thumbnail_url` y `url` coinciden por construcción del fixture; lo que importa es que no haya más.
check('mismos valores campo por campo', distintos.length === 0,
  distintos.map((k) => `${k}: apify=${deApify[k]} virlo=${deVirlo[k]}`).join(' · '));

console.log('── external_id (del que dependen dedup, caché de transcripts y videos_meta)');
check('la copia del alfabeto da lo mismo que la del cockpit', ['DVJbxxfCHZ2', 'C_xYz-12_ab', 'Day8CXdBLwK'].every((s) => shortcodeAExternalId(s) === delCockpit(s)));
check('id uuid de Virlo → se deriva de la url', externalIdVirlo(VIRLO, 'instagram') === MEDIA_ID);
check('id numérico con owner (`media_owner`) → la primera parte', externalIdVirlo({ id: `${MEDIA_ID}_999` }, 'instagram') === MEDIA_ID);
check('url de reel con /reel/ y con usuario adelante', externalIdVirlo({ url: `https://www.instagram.com/cuentaa/reel/${SHORTCODE}/?igsh=x` }, 'instagram') === MEDIA_ID);
check('sin id ni url → vacío (no inventa)', externalIdVirlo({}, 'instagram') === '');
check('TikTok: sale de /video/<id>', externalIdVirlo({ id: 'abc', url: 'https://www.tiktok.com/@x/video/7412345678901234567' }, 'tiktok') === '7412345678901234567');

console.log('── qué es un video');
check('reel con vistas: sí', esVideoVirlo(VIRLO));
check('foto de IG (views 0): no', !esVideoVirlo({ ...VIRLO, views: 0 }));
check('is_video false: no', !esVideoVirlo({ ...VIRLO, is_video: false }));
check('carrusel: no', !esVideoVirlo({ ...VIRLO, content_type: 'carousel' }));

console.log('── TikTok lleva idioma_nativo como Normalizar TT');
const tt = normalizarVideoVirlo({ ...VIRLO, url: 'https://www.tiktok.com/@x/video/7412345678901234567', language: 'en' }, CREADOR, 'tiktok');
check('plataforma, id e idioma', tt.plataforma === 'tiktok' && tt.external_id === '7412345678901234567' && tt.idioma_nativo === 'en', JSON.stringify(tt));

console.log('── fila de pool_crudo');
const fila = filaPoolCrudoVirlo(VIRLO, { handle: '@CuentaA', medido_en: '2026-09-28T10:00:00.000Z', job_id: 'job1', instance_id: 'i1', seguidores: 120000 });
check('proveedor virlo y dataset sintético virlo:<job>', fila.proveedor === 'virlo' && fila.apify_dataset_id === 'virlo:job1' && fila.origen === 'motor');
check('handle normalizado como el resto de pool_crudo (sin @, minúsculas)', fila.handle === 'cuentaa');
check('mismo external_id que la forma interna', fila.external_id === deVirlo.external_id);
check('publicado_en en ISO completo (la marca de agua compara horas, no días)', fila.publicado_en === '2026-09-20T14:00:00.000Z', fila.publicado_en);
check('una fecha que ya trae zona se respeta', fechaUtc('2026-09-20T14:00:00-05:00').toISOString() === '2026-09-20T19:00:00.000Z');
check('fecha rota → null, no Invalid Date', fechaUtc('ayer') === null && fechaUtc(null) === null);
check('sin duración → null, no 0', filaPoolCrudoVirlo({ ...VIRLO, duration: undefined }, { handle: 'a', medido_en: 'x', job_id: 'j', instance_id: 'i' }).duracion_seg === null);

console.log('── muestra del playground (forma real, valores de muestra; 01/10)');
const PG = JSON.parse(readFileSync(join(aqui, 'fixtures/virlo/playground/agent-videos-transcript.json'), 'utf8')).data.videos;
const pgTT = PG.find((v) => v.platform === 'tiktok');
const pgYT = PG.find((v) => v.platform === 'youtube');
const nTT = normalizarVideoVirlo(pgTT, {}, 'tiktok');
check('TikTok: id uuid → external_id de la url', nTT.external_id === '7412345678901234567', nTT.external_id);
check('TikTok: el creador sale de `author` sin pasarlo aparte', nTT.username === 'fitcoachjen' && nTT.seguidores === 48200, JSON.stringify(nTT));
check('TikTok: duración en segundos y fecha UTC', nTT.duracion_video === 34 && nTT.fecha_publicacion === '2026-09-21');
check('TikTok: idioma desde intelligence.language_detected', normalizarVideoVirlo({ ...pgTT, intelligence: { language_detected: 'es' } }, {}, 'tiktok').idioma_nativo === 'es');
check('es video aunque no traiga is_video ni content_type', esVideoVirlo(pgTT) && esVideoVirlo(pgYT));
const nYT = normalizarVideoVirlo(pgYT, {}, 'youtube');
check('YouTube: `@` y `#` se limpian', nYT.username === 'proteinpantry' && nYT.hashtags === 'shorts, mealprep, highprotein', JSON.stringify(nYT));
// D-8 abierta: YouTube no tiene external_id propio todavía. Vacío es lo correcto (no inventa).
check('YouTube: sin regla de id todavía → vacío, no un id falso', nYT.external_id === '');
check('transcript: `transcribed` trae segments, `platform` no (ADR-095 no puede medir cobertura sin tiempos)',
  pgTT.transcript.source === 'transcribed' && Array.isArray(pgTT.transcript.segments) && pgYT.transcript.source === 'platform' && pgYT.transcript.segments === null);

console.log(fail ? `\n${fail} test(s) en rojo` : '\nTodo en verde');
process.exit(fail ? 1 : 0);
