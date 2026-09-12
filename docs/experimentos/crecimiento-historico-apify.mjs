#!/usr/bin/env node
// Curva de crecimiento de vistas, GRATIS, desde el histórico de Apify.
//
// 🔑 POR QUÉ EXISTE. La conclusión "las vistas se congelan" salía de una medición de 52 minutos,
// que no tiene resolución para ver crecimiento lento (plan-refactor-motor §1.2). Para medir en
// días/semanas hacía falta el mismo reel en dos fechas — y ya lo teníamos: el motor RE-COMPRÓ los
// mismos reels corrida tras corrida (74% del gasto de un día), así que cada reel quedó medido
// varias veces dentro de datasets YA PAGADOS. Leer datasets no cobra.
//
//   Lo que se contaba como desperdicio es, para esta pregunta, el activo.
//
// 🔴 VENCE EL 2026-10-11. Apify (plan STARTER) borra datasets a los 31 días, así que la ventana se
// corre un día por día. Lo que no se extraiga antes se pierde para siempre.
//
// USO:  set -a && source .env && set +a && node docs/experimentos/crecimiento-historico-apify.mjs
//       node docs/experimentos/crecimiento-historico-apify.mjs --json > salida.json
//
// ⚠️ SOLO LEE. No dispara actores, no escribe en Supabase, no cuesta un centavo.

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) { console.error('Falta APIFY_TOKEN (está en el .env de la raíz).'); process.exit(1); }

const JSON_OUT = process.argv.includes('--json');
// Cuántos datasets leer por día. Subilo para un censo; con 14 alcanzó para la medición del 12/09.
const POR_DIA = Number(process.env.DATASETS_POR_DIA || 14);

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json().catch(() => null);
};

// 1. Todos los actor-runs que Apify todavía conserva (pagina de a 200).
const runs = [];
for (const offset of [0, 200, 400, 600]) {
  const d = await get(`https://api.apify.com/v2/actor-runs?token=${TOKEN}&limit=200&offset=${offset}&desc=1`);
  const items = d?.data?.items ?? [];
  runs.push(...items);
  if (items.length < 200) break;
}
const ok = runs.filter((r) => r.status === 'SUCCEEDED' && r.defaultDatasetId);

// 2. Un mapa {shortCode -> vistas} por día, mezclando los datasets de ese día.
const porDia = new Map();
for (const r of ok) {
  const f = r.startedAt.slice(0, 10);
  if (!porDia.has(f)) porDia.set(f, []);
  porDia.get(f).push(r);
}

const vistasPorDia = new Map();
const publicadoEn = new Map(); // shortCode -> timestamp de publicación (lo necesita M1-bis)
for (const [f, rs] of [...porDia].sort()) {
  // Los datasets más grandes primero: son los del scraper de reels, no los de una sola URL.
  rs.sort((a, b) => (b.stats?.computeUnits ?? 0) - (a.stats?.computeUnits ?? 0));
  const m = new Map();
  for (const r of rs.slice(0, POR_DIA)) {
    const items = await get(`https://api.apify.com/v2/datasets/${r.defaultDatasetId}/items?token=${TOKEN}&limit=1000`);
    for (const x of Array.isArray(items) ? items : []) {
      const sc = x.shortCode;
      const v = x.videoPlayCount ?? x.videoViewCount;
      if (!sc || !Number.isInteger(v) || v <= 0) continue;
      if (!m.has(sc)) m.set(sc, v);
      if (x.timestamp && !publicadoEn.has(sc)) publicadoEn.set(sc, x.timestamp);
    }
  }
  if (m.size) vistasPorDia.set(f, m);
}

// 3. Cruzar cada par de fechas: mismo reel, dos momentos.
const fechas = [...vistasPorDia.keys()].sort();
const pares = [];
for (let i = 0; i < fechas.length; i++) {
  for (let j = i + 1; j < fechas.length; j++) {
    const [a, b] = [fechas[i], fechas[j]];
    const A = vistasPorDia.get(a), B = vistasPorDia.get(b);
    const comunes = [...A.keys()].filter((sc) => B.has(sc) && A.get(sc) > 0);
    if (comunes.length < 10) continue;
    const crec = comunes.map((sc) => (B.get(sc) - A.get(sc)) / A.get(sc)).sort((x, y) => x - y);
    const dias = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    pares.push({
      de: a, a: b, dias,
      reels: comunes.length,
      // Mediana y no promedio: un reel que explota arrastra el promedio y no describe al típico.
      crecimiento_mediano: crec[Math.floor(crec.length / 2)],
      subieron: crec.filter((c) => c > 0).length,
    });
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    medido_en: new Date().toISOString(),
    runs_conservados: ok.length,
    dia_mas_viejo: fechas[0], dia_mas_nuevo: fechas.at(-1),
    reels_por_dia: Object.fromEntries([...vistasPorDia].map(([f, m]) => [f, m.size])),
    pares,
  }, null, 2));
} else {
  console.log(`runs SUCCEEDED con dataset: ${ok.length}`);
  for (const [f, m] of vistasPorDia) console.log(`${f}: ${porDia.get(f).length} runs, ${m.size} reels con vistas`);
  console.log('\n=== MISMO REEL EN DOS FECHAS ===');
  console.log('de           a           días  reels   crec.mediano   subieron');
  for (const p of pares) {
    const pct = (p.crecimiento_mediano * 100).toFixed(2).padStart(6);
    console.log(`${p.de}  ${p.a}  ${String(p.dias).padStart(4)}  ${String(p.reels).padStart(5)}   ${pct}%   ${p.subieron}/${p.reels}`);
  }
}

// ⬜ PENDIENTE — M1-bis, la curva del reel JOVEN, que es la mitad que falta.
// `publicadoEn` ya trae el timestamp de publicación de cada reel. Falta filtrar los pares por
// EDAD EN LA PRIMERA MEDICIÓN y quedarse con los que eran nuevos: los de arriba son casi todos
// reels que ya eran viejos, así que describen la cola y no el arranque. Misma fuente, mismo costo
// (cero), y el arranque es donde el crecimiento es grande.
