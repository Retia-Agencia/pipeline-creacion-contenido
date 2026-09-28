#!/usr/bin/env node
// comparar-proveedores.mjs — Fase 3 de docs/agents/plan-migracion-virlo.md: Apify contra Virlo sobre
// los MISMOS días de sombra, reel por reel, leyendo app.pool_crudo. Solo lee.
//
//   set -a && source .env && set +a && node Workflows/workflow-short-form-content/comparar-proveedores.mjs [flags]
//
//   --dias N          ventana de medición hacia atrás (default 7): cuándo se MIDIÓ, no cuándo se publicó
//   --min-views N     el piso para "entregable" (default: el ajuste 'Mínimo de vistas', o 500.000)
//   --instancia UUID  una sola instancia (default: todas)
//
// 🔑 El criterio de pase se escribió ANTES de mirar (plan §Fases): Virlo trae ≥ 90 % de los reels que
// Apify trae sobre el piso, y el costo mensual cierra. Este script imprime los dos números y el
// veredicto; no decide el precio, que se negocia.
//
// Grano: la ÚLTIMA observación de cada (proveedor, reel) dentro de la ventana. Un reel medido dos
// veces por el mismo proveedor cuenta una vez, con sus vistas más nuevas.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE. Cargá el .env:');
  console.error('  set -a && source .env && set +a && node <este archivo>');
  process.exit(1);
}

const args = process.argv.slice(2);
const valor = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const DIAS = Number(valor('dias', 7));
const INSTANCIA = valor('instancia', null);
const USD_POR_REEL_APIFY = 0.0023; // apps/dashboard/domain/corrida.ts, app.tarifas 'apify_ig'
const COBERTURA_PASE = 0.9;
const PAGINA = 1000; // max-rows de PostgREST: pedir más devuelve 1.000 sin avisar (ADR-029 §Enmienda)

const cabeceras = { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` };

async function leerTodo(ruta, esquema) {
  const filas = [];
  for (let offset = 0; ; offset += PAGINA) {
    const sep = ruta.includes('?') ? '&' : '?';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}${sep}limit=${PAGINA}&offset=${offset}`, {
      headers: { ...cabeceras, ...(esquema ? { 'Accept-Profile': esquema } : {}) },
    });
    if (!r.ok) throw new Error(`GET ${ruta} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < PAGINA) return filas;
  }
}

const mediana = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b ? `${(a / b * 100).toFixed(1)} %` : '—');
const fmt = (n) => Number(n).toLocaleString('es');

const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString();
const filtroInst = INSTANCIA ? `&instance_id=eq.${INSTANCIA}` : '';

let piso = valor('min-views', null);
if (piso == null) {
  const aj = await leerTodo(`ajustes?select=valor&clave=eq.${encodeURIComponent('Mínimo de vistas')}${filtroInst}`, 'app').catch(() => []);
  piso = aj.length ? Math.min(...aj.map((a) => Number(a.valor))) : 500_000;
}
piso = Number(piso);

// `proveedor` existe desde la 046. Antes de aplicarla, la columna no está: se lee todo como Apify.
let filas;
let conColumna = true;
try {
  filas = await leerTodo(`pool_crudo?select=instance_id,plataforma,external_id,handle,publicado_en,vistas,medido_en,proveedor&medido_en=gte.${desde}${filtroInst}&order=medido_en.desc`, 'app');
} catch (e) {
  if (!/42703/.test(e.message)) throw e;
  conColumna = false;
  filas = await leerTodo(`pool_crudo?select=instance_id,plataforma,external_id,handle,publicado_en,vistas,medido_en&medido_en=gte.${desde}${filtroInst}&order=medido_en.desc`, 'app');
}

// Última observación por (proveedor, reel). `filas` viene ordenado por medido_en desc.
const porProveedor = { apify: new Map(), virlo: new Map() };
for (const f of filas) {
  const prov = f.proveedor ?? 'apify';
  const clave = `${f.instance_id}|${f.plataforma}|${f.external_id}`;
  if (porProveedor[prov] && !porProveedor[prov].has(clave)) porProveedor[prov].set(clave, f);
}
const A = porProveedor.apify;
const V = porProveedor.virlo;

console.log(`Ventana: medido en los últimos ${DIAS} días (desde ${desde.slice(0, 10)}) · piso ${fmt(piso)} vistas`);
if (!conColumna) console.log('⚠️ pool_crudo todavía no tiene `proveedor` (falta aplicar la 046): todo se lee como Apify.');

function resumen(nombre, m) {
  const reels = [...m.values()];
  const cuentas = new Set(reels.map((r) => r.handle));
  const sobre = reels.filter((r) => Number(r.vistas) >= piso);
  // Alcance: cuántos días hacia atrás llegó cada cuenta (el reel más viejo medido, contra su medición).
  const alcances = [...cuentas].map((h) => {
    const suyos = reels.filter((r) => r.handle === h && r.publicado_en);
    return Math.max(...suyos.map((r) => (Date.parse(r.medido_en) - Date.parse(r.publicado_en)) / 86_400_000));
  }).filter(Number.isFinite);
  console.log(`\n${nombre.padEnd(6)} ${fmt(reels.length)} reels · ${cuentas.size} cuentas · ${fmt(sobre.length)} sobre el piso · alcance mediano ${mediana(alcances)?.toFixed(0) ?? '—'} días`);
  return { reels, cuentas, sobre };
}

const ra = resumen('Apify', A);
const rv = resumen('Virlo', V);

if (!V.size) {
  console.log('\nSin observaciones de Virlo en la ventana: todavía no hubo corridas en sombra (ajuste');
  console.log("'Proveedor de scraping' = 1 con la rama Virlo en el motor). No hay nada que comparar.");
  process.exit(0);
}

// Solo se comparan las cuentas que miraron los dos: una cuenta que Virlo no buscó no es un reel perdido.
const cuentasComunes = new Set([...ra.cuentas].filter((h) => rv.cuentas.has(h)));
const enComun = (m) => new Map([...m].filter(([, r]) => cuentasComunes.has(r.handle)));
const Ac = enComun(A);
const Vc = enComun(V);
const ambos = [...Ac.keys()].filter((k) => Vc.has(k));
const soloA = [...Ac.keys()].filter((k) => !Vc.has(k));
const soloV = [...Vc.keys()].filter((k) => !Ac.has(k));

console.log(`\nCuentas que miraron los dos: ${cuentasComunes.size}`);
console.log(`  reels en los dos ${fmt(ambos.length)} · solo Apify ${fmt(soloA.length)} · solo Virlo ${fmt(soloV.length)}`);

// Sobre el piso: lo que de verdad se entrega. Un reel cuenta como "sobre el piso" si lo está para
// cualquiera de los dos (las vistas crecen: el más nuevo puede cruzarlo y el otro no).
const sobrePiso = (k) => Math.max(Number(Ac.get(k)?.vistas ?? 0), Number(Vc.get(k)?.vistas ?? 0)) >= piso;
const entregablesA = [...Ac.keys()].filter(sobrePiso);
const cubiertos = entregablesA.filter((k) => Vc.has(k));
const cobertura = entregablesA.length ? cubiertos.length / entregablesA.length : null;
const extraV = [...Vc.keys()].filter((k) => !Ac.has(k) && sobrePiso(k)).length;
console.log(`\nSobre el piso, de lo que trae Apify Virlo también trae: ${cubiertos.length}/${entregablesA.length} = ${pct(cubiertos.length, entregablesA.length)}`);
console.log(`Sobre el piso que trae Virlo y Apify no: ${extraV}`);

// Mismo reel, medido por los dos con menos de 2 días de diferencia: ¿dicen las mismas vistas?
const deltas = ambos.map((k) => {
  const a = Ac.get(k);
  const v = Vc.get(k);
  if (Math.abs(Date.parse(a.medido_en) - Date.parse(v.medido_en)) > 2 * 86_400_000 || !Number(a.vistas)) return null;
  return (Number(v.vistas) - Number(a.vistas)) / Number(a.vistas) * 100;
}).filter((x) => x != null);
console.log(`Vistas del mismo reel (medidos con < 2 días de diferencia, ${deltas.length} pares): Δ mediano Virlo vs Apify ${mediana(deltas)?.toFixed(1) ?? '—'} %`);

// Costo: Apify por reel comprado; Virlo por lo que el motor anotó de su X-Cost en runs.metricas.
const runs = await leerTodo(`runs?select=metricas,inicio,instance_id&inicio=gte.${desde}${filtroInst}&params->>workflow=eq.motor`).catch(() => []);
const usdApify = runs.reduce((s, r) => s + Number(r.metricas?.apify_ig ?? 0) * USD_POR_REEL_APIFY, 0);
const usdVirlo = runs.reduce((s, r) => s + Number(r.metricas?.virlo_costo_usd ?? 0), 0);
console.log(`\nCosto en la ventana (${runs.length} corridas): Apify ~${usdApify.toFixed(2)} USD · Virlo ${usdVirlo.toFixed(2)} USD`);
const porSemana = 7 / DIAS;
console.log(`A ritmo mensual (×${(porSemana * 4.3).toFixed(1)}): Apify ~${(usdApify * porSemana * 4.3).toFixed(0)} USD · Virlo ~${(usdVirlo * porSemana * 4.3).toFixed(0)} USD`);

console.log(cobertura == null
  ? '\nVeredicto: sin reels de Apify sobre el piso en cuentas comunes; ampliá --dias.'
  : cobertura >= COBERTURA_PASE
    ? `\n✅ Cobertura ${pct(cubiertos.length, entregablesA.length)} ≥ ${COBERTURA_PASE * 100} %. Falta la otra mitad del criterio: que el costo cierre.`
    : `\n⛔ Cobertura ${pct(cubiertos.length, entregablesA.length)} < ${COBERTURA_PASE * 100} %: Virlo todavía no reemplaza a Apify.`);
