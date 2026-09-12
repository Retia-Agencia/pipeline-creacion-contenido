#!/usr/bin/env node
// Chequeador de links markdown del repo.
// Uso: node core/scripts/check-links.mjs   (desde cualquier directorio del repo)
// Exit 0 = todos los destinos existen · Exit 1 = hay links rotos.
//
// Por qué existe: el 2026-09-12 mover 4 archivos rompió ~90 referencias en 24 archivos, y se
// encontraron porque a alguien se le ocurrió chequear, no porque algo avisara. Cubre SOLO links
// rotos: los otros dos chequeos que se propusieron (un doc vivo fuera del mapa de CLAUDE.md, el
// mapa apuntando a algo archivado) exigen una convención de "doc vivo" que hoy no existe, y la
// regla escrita —un hecho, un dueño— ya los cubre sin código.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// git ls-files: sólo lo versionado. Deja afuera node_modules y los worktrees de .claude/.
const archivos = execSync('git ls-files "*.md"', { cwd: REPO, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

// Destinos de link markdown. Dos formas, y la segunda no es opcional: el repo usa <...> para las
// rutas con paréntesis (app/(zonas)/...), que un regex de paréntesis balanceados parte al medio.
const LINK = /\[[^\]]*\]\(\s*(?:<([^>]+)>|([^()\s]+))\s*(?:"[^"]*")?\)/g;

const rotos = [];
for (const archivo of archivos) {
  const texto = readFileSync(resolve(REPO, archivo), "utf8");
  for (const m of texto.matchAll(LINK)) {
    const destino = m[1] ?? m[2];
    if (/^(https?:|mailto:|tel:|#)/i.test(destino)) continue;   // externo o ancla interna
    const ruta = destino.split("#")[0];                          // ruta#ancla → ruta
    if (!ruta) continue;
    const abs = resolve(dirname(resolve(REPO, archivo)), decodeURIComponent(ruta));
    if (!existsSync(abs)) rotos.push({ archivo, destino });
  }
}

if (rotos.length) {
  console.error(`\n❌ ${rotos.length} link(s) roto(s):\n`);
  for (const r of rotos) console.error(`   ${r.archivo} → ${r.destino}`);
  console.error(`\nRevisados ${archivos.length} archivos .md.\n`);
  process.exit(1);
}
console.log(`✅ Links: 0 rotos en ${archivos.length} archivos .md.`);
