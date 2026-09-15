# Plan de implementación — Marca de agua + re-medición del reel joven (ADR-100)

> **Para agentes:** ejecutar tarea por tarea, en orden. Cada tarea termina con sus tests en verde.
> **No hagas commit, no apliques migraciones en prod, no corras `n8n:push --apply` ni el webhook del
> motor.** Esas tres cosas son de la Tarea 6 y tienen gate humano.

**Objetivo:** que cada corrida del motor compre solo lo publicado desde la última compra de cada
cuenta, y re-mida por URL los reels jóvenes que quedaron cerca del piso.

**Arquitectura:** la fachada `GET /api/engine/run-plan` calcula por referente `desde`, `limite` y
`ritmo_semanal`, y la lista `remedir`, leyendo dos vistas nuevas sobre `app.pool_crudo`. El motor
solo ejecuta: `Split IG referentes` emite un ítem por cuenta más uno con los reels a re-medir, y
`Apify — IG Reels` arma el body desde el ítem. Cero nodos o conexiones nuevas.

**Stack:** Postgres (Supabase, migraciones a mano) · Next.js + TypeScript en `apps/dashboard`
(`node:test` sobre `domain/`) · n8n Code nodes (`test-nodos.mjs`, node pelado).

**Spec:** [ADR-100](../adr/ADR-100-se-compra-lo-nuevo-y-se-remide-lo-joven.md). Leerla antes de
empezar. Datos que la sostienen: [plan-refactor-motor §1.4](./plan-refactor-motor.md).

## Restricciones globales (copiadas de ADR-100)

- `desde = max(marca_de_agua, ahora − Días de recencia)`; sin marca → `ahora − Días de recencia`.
- `ritmo_semanal` = reels distintos con `publicado_en` en los últimos **28** días ÷ **4**.
- `limite = max(Resultados por cuenta de referente, ceil(ritmo_semanal × días_desde ÷ 7 × 1,3))`.
  El motor lo recorta con `cap_resultados_referente` y avisa nombrando la cuenta.
- Re-medir si la última observación: edad al medir **< 7 días** · vistas en **[0,25 × piso, piso)** ·
  medida hace **≥ 1 día** · publicada dentro de **Días de recencia** · no está en
  `processed_items` · handle de un referente IG activo del plan. Orden vistas desc, **tope 200**.
- URL de re-medición: `https://www.instagram.com/reel/<shortcode>/`, shortcode = media id en base64
  de Instagram (`A-Z a-z 0-9 - _`). Par verificado: `3839722324954216054` → `DVJbxxfCHZ2`.
- Aditivo: `version` del plan sigue en **2**. Solo `?ambito=motor` trae los campos nuevos.
- Interruptor: clave de ajuste **`Usar marca de agua`**, toggle, default **1**, visibilidad `dev`.
- Si la fachada no puede leer las vistas: **no aborta**. Sirve `desde: null`, `limite: null`,
  `remedir: []`, `marca_de_agua: false`, `marca_de_agua_motivo: "<texto>"`.
- Motor con interruptor apagado, `marca_de_agua !== true` o referente sin `desde`: compra como hoy
  (`onlyPostsNewerThan = "<Días de recencia> days"`, `resultsLimit = Resultados por cuenta`).
- Normalización de handle igual a `pool_crudo`: `trim`, sin `@` inicial, minúsculas.
- Mensajes de `throw` en el motor sin `:` (n8n corta el mensaje en el último `:`). Los `avisos` sí
  pueden llevarlo.

## Mapa de archivos

| Archivo | Qué hace | Tarea |
|---|---|---|
| `core/schema/045_marca_de_agua.sql` | 2 vistas + clave de ajuste | 1 |
| `apps/dashboard/domain/marca-de-agua.ts` | Reglas puras: `desdeDe`, `limiteDe`, `elegirRemedir`, `shortcodeDe`, `valorAjuste` | 2 |
| `apps/dashboard/domain/marca-de-agua.test.ts` | Tests de lo anterior | 2 |
| `apps/dashboard/domain/run-plan.ts` | `conMarcaDeAgua(plan, datos, ahora)` | 3 |
| `apps/dashboard/lib/marca-de-agua.ts` | Lee las vistas con `scoped()` | 3 |
| `apps/dashboard/lib/supabase/scoped.ts` | Registra las 3 vistas en el mapa de granos | 3 |
| `apps/dashboard/app/api/engine/run-plan/route.ts` | Llama a lo anterior en `ambito=motor` | 3 |
| `apps/dashboard/domain/ajustes.ts` | `CATALOGO` suma `Usar marca de agua` | 3 |
| `core/contracts/run-plan.md` | Documenta los campos nuevos | 3 |
| `Workflows/workflow-short-form-content/workflow.json` | 4 nodos: `Armar plan de corrida`, `Split IG referentes`, `Apify — IG Reels`, `Etapa: colecta` | 4 |
| `Workflows/workflow-short-form-content/test-nodos.mjs` | Tests de esos nodos | 4 |

---

### Tarea 1: Migración `045`

**Archivos:** Crear `core/schema/045_marca_de_agua.sql`.

**Produce:** `app.v_ritmo_referentes(instance_id, plataforma, handle, ritmo_semanal)` y
`app.v_remedir_candidatos(instance_id, plataforma, external_id, handle, publicado_en, medido_en,
vistas, edad_al_medir_dias)`; clave `Usar marca de agua` en `app.ajustes`.

- [ ] **Paso 1: escribir la migración**

```sql
-- 045 · Marca de agua + re-medición del reel joven (ADR-100 §D7)
-- Aditiva. Se aplica a mano en el SQL Editor, DESPUÉS de la 044 y ANTES del deploy de la app.

-- 1. Ritmo de publicación por cuenta: reels distintos publicados en los últimos 28 días ÷ 4.
create or replace view app.v_ritmo_referentes
with (security_invoker = true) as
  select instance_id,
         plataforma,
         handle,
         (count(distinct external_id) filter (where publicado_en > now() - interval '28 days'))::numeric / 4
           as ritmo_semanal
    from app.pool_crudo
   group by instance_id, plataforma, handle;

comment on view app.v_ritmo_referentes is
  'ADR-100 D2: reels por semana de cada cuenta (28 dias / 4), para dimensionar resultsLimit. '
  'Subestima en cuentas que topaban el resultsLimit viejo (25).';

-- 2. Última observación de cada reel, sin lo ya entregado. Los umbrales (piso, días) NO viven acá:
--    son ajustes que se mueven, y los aplica la fachada al leer (ADR-100 §D3).
create or replace view app.v_remedir_candidatos
with (security_invoker = true) as
  select distinct on (p.instance_id, p.plataforma, p.external_id)
         p.instance_id,
         p.plataforma,
         p.external_id,
         p.handle,
         p.publicado_en,
         p.medido_en,
         p.vistas,
         extract(epoch from p.medido_en - p.publicado_en) / 86400 as edad_al_medir_dias
    from app.pool_crudo p
   where p.publicado_en is not null
     and p.vistas is not null
     and not exists (
       select 1 from public.processed_items pi
        where pi.instance_id = p.instance_id
          and pi.external_id = p.external_id
     )
   order by p.instance_id, p.plataforma, p.external_id, p.medido_en desc;

comment on view app.v_remedir_candidatos is
  'ADR-100 D3: ultima observacion por reel, excluyendo lo entregado (processed_items). '
  'La fachada filtra edad < 7 d, vistas en [0,25 x piso, piso), medido hace >= 1 d y recencia.';

grant select on app.v_ritmo_referentes, app.v_remedir_candidatos to authenticated;

-- 3. Interruptor. Una clave nueva entra en tres lados o no existe: este check, CATALOGO de
--    domain/ajustes.ts y AJUSTE_MAP del motor.
alter table app.ajustes drop constraint ajustes_clave_check;
alter table app.ajustes add constraint ajustes_clave_check check (clave in (
  'Peso de vistas', 'Peso de likes', 'Peso de interacción', 'Peso de relevancia',
  'Bonus idioma extranjero', 'Seguidores para marcar viral',
  'Mínimo de vistas', 'Mínimo de likes', 'Relevancia mínima',
  'Videos a transcribir por corrida', 'Días de recencia', 'Resultados por cuenta de referente',
  'Buscar por referentes en Instagram', 'Buscar por referentes en TikTok',
  'Propuestas por corrida', 'Afinidad mínima de propuesta',
  'Descubrir en Instagram', 'Descubrir en TikTok',
  'Usar marca de agua'
));

insert into app.ajustes (instance_id, clave, valor, descripcion, visibilidad)
select a.instance_id, 'Usar marca de agua', 1,
       'ADR-100. 1 = a cada cuenta se le compra solo lo publicado desde su última compra, y se '
       || 're-miden por link los reels jóvenes cerca del piso. 0 = se compra como antes (ventana '
       || 'fija de Días de recencia). Es el botón de rollback.',
       'dev'
  from app.ajustes a
 where a.clave = 'Días de recencia'
   and not exists (select 1 from app.ajustes b
                    where b.instance_id = a.instance_id and b.clave = 'Usar marca de agua');

update app.ajustes
   set descripcion = 'Con marca de agua (ADR-100) es el TECHO de cuánto se mira hacia atrás: aplica '
                     || 'a cuentas nuevas o sin comprar hace mucho. Sin marca de agua es la ventana fija.'
 where clave = 'Días de recencia';

-- ═══════════ Verificación (correr y LEER — por efecto, no por haber corrido) ═══════════
-- a) select count(*), sum(ritmo_semanal) from app.v_ritmo_referentes;          -- > 0 filas
-- b) select count(*) from app.v_remedir_candidatos
--     where edad_al_medir_dias < 7 and vistas >= 100000 and vistas < 400000;   -- del orden de 74-88
-- c) un reel entregado NO aparece:
--    select count(*) from app.v_remedir_candidatos r
--      join public.processed_items pi using (instance_id, external_id);         -- 0
-- d) select clave, valor, visibilidad from app.ajustes where clave = 'Usar marca de agua'; -- 1 fila, 1, dev
-- e) insert de una clave inventada rebota con 23514.
```

- [ ] **Paso 2: revisar contra el esquema real.** Confirmar que `public.processed_items` tiene
  `instance_id` y `external_id` (sí, medido el 15/09), y que `app.ajustes` tiene `instance_id`,
  `clave`, `valor`, `descripcion`, `visibilidad`. **No aplicarla.**

---

### Tarea 2: Reglas puras de la marca de agua

**Archivos:** Crear `apps/dashboard/domain/marca-de-agua.ts` y `apps/dashboard/domain/marca-de-agua.test.ts`.

**Produce (firmas exactas que usan las Tareas 3 y 4):**

```ts
export const DIAS_JOVEN = 7;
export const FRACCION_PISO_REMEDIR = 0.25;
export const TOPE_REMEDIR = 200;
export const HOLGURA_CUPO = 1.3;
export function normalizarHandlePool(h: string): string;
export function desdeDe(watermark: string | null, diasRecencia: number, ahora: Date): string;
export function limiteDe(ritmoSemanal: number | null, desde: string, resultadosPorCuenta: number, ahora: Date): number;
export function shortcodeDe(mediaId: string): string | null;
export type Observacion = { external_id: string; handle: string; publicado_en: string; medido_en: string; vistas: number; edad_al_medir_dias: number };
export type ReelARemedir = { external_id: string; handle: string; url: string };
export function elegirRemedir(obs: Observacion[], o: { piso: number; diasRecencia: number; handlesActivos: Set<string>; ahora: Date; tope?: number }): { lista: ReelARemedir[]; cortados: number };
export function valorAjuste(ajustes: { fields: Record<string, unknown> }[], clave: string, defecto: number): number;
```

- [ ] **Paso 1: escribir el test que falla**

```ts
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  desdeDe, elegirRemedir, limiteDe, normalizarHandlePool, shortcodeDe, valorAjuste,
  type Observacion,
} from "./marca-de-agua.ts";

const AHORA = new Date("2026-09-15T12:00:00.000Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();

describe("desdeDe", () => {
  it("usa la marca si es más nueva que el techo", () => {
    assert.equal(desdeDe(hace(8), 30, AHORA), hace(8));
  });
  it("usa el techo si la marca es más vieja", () => {
    assert.equal(desdeDe(hace(43), 30, AHORA), hace(30));
  });
  it("cuenta sin marca: el techo", () => {
    assert.equal(desdeDe(null, 30, AHORA), hace(30));
  });
  it("marca ilegible: el techo", () => {
    assert.equal(desdeDe("no-es-fecha", 30, AHORA), hace(30));
  });
});

describe("limiteDe", () => {
  it("nunca baja de Resultados por cuenta", () => {
    assert.equal(limiteDe(2, hace(7), 25, AHORA), 25);
  });
  it("tapa el hueco: ritmo × días ÷ 7 × 1,3, hacia arriba", () => {
    // 20/semana × 21 días ÷ 7 × 1,3 = 78
    assert.equal(limiteDe(20, hace(21), 25, AHORA), 78);
  });
  it("sin ritmo conocido: Resultados por cuenta", () => {
    assert.equal(limiteDe(null, hace(30), 25, AHORA), 25);
  });
});

describe("shortcodeDe", () => {
  it("par verificado contra Apify el 15/09", () => {
    assert.equal(shortcodeDe("3839722324954216054"), "DVJbxxfCHZ2");
  });
  it("id no numérico: null", () => {
    assert.equal(shortcodeDe("DVJbxxfCHZ2"), null);
    assert.equal(shortcodeDe(""), null);
  });
});

describe("normalizarHandlePool", () => {
  it("igual que pool_crudo", () => {
    assert.equal(normalizarHandlePool("  @AskVinh "), "askvinh");
  });
});

describe("elegirRemedir", () => {
  const base: Observacion = {
    external_id: "3839722324954216054", handle: "askvinh",
    publicado_en: hace(5), medido_en: hace(3), vistas: 200_000, edad_al_medir_dias: 2,
  };
  const opts = { piso: 400_000, diasRecencia: 30, handlesActivos: new Set(["askvinh"]), ahora: AHORA };
  const una = (cambio: Partial<Observacion>) => elegirRemedir([{ ...base, ...cambio }], opts).lista.length;

  it("entra el caso típico, con URL de reel", () => {
    const r = elegirRemedir([base], opts);
    assert.deepEqual(r.lista, [{ external_id: base.external_id, handle: "askvinh", url: "https://www.instagram.com/reel/DVJbxxfCHZ2/" }]);
    assert.equal(r.cortados, 0);
  });
  it("edad al medir: 6,9 entra, 7 no", () => {
    assert.equal(una({ edad_al_medir_dias: 6.9 }), 1);
    assert.equal(una({ edad_al_medir_dias: 7 }), 0);
  });
  it("banda: 100.000 entra, 99.999 no, 399.999 entra, 400.000 no", () => {
    assert.equal(una({ vistas: 100_000 }), 1);
    assert.equal(una({ vistas: 99_999 }), 0);
    assert.equal(una({ vistas: 399_999 }), 1);
    assert.equal(una({ vistas: 400_000 }), 0);
  });
  it("medido hace menos de 1 día: no", () => {
    assert.equal(una({ medido_en: hace(0.5) }), 0);
  });
  it("publicado fuera de la recencia: no", () => {
    assert.equal(una({ publicado_en: hace(31) }), 0);
  });
  it("handle no activo: no; y compara normalizado", () => {
    assert.equal(una({ handle: "otra" }), 0);
    assert.equal(una({ handle: "@AskVinh" }), 1);
  });
  it("external_id sin shortcode posible: se salta", () => {
    assert.equal(una({ external_id: "abc" }), 0);
  });
  it("ordena por vistas desc y corta en el tope, contando los cortados", () => {
    const obs = [150_000, 390_000, 250_000].map((v, i) => ({ ...base, external_id: String(3839722324954216054n + BigInt(i)), vistas: v }));
    const r = elegirRemedir(obs, { ...opts, tope: 2 });
    assert.equal(r.lista.length, 2);
    assert.equal(r.cortados, 1);
    assert.equal(r.lista[0].external_id, obs[1].external_id);
  });
});

describe("valorAjuste", () => {
  const ajustes = [{ fields: { clave: "Días de recencia", valor: 30 } }, { fields: { clave: "Usar marca de agua", valor: 0 } }];
  it("lee por clave", () => assert.equal(valorAjuste(ajustes, "Días de recencia", 7), 30));
  it("respeta el 0", () => assert.equal(valorAjuste(ajustes, "Usar marca de agua", 1), 0));
  it("default si falta", () => assert.equal(valorAjuste(ajustes, "Mínimo de vistas", 5), 5));
});
```

- [ ] **Paso 2: correr y ver que falla.**
  Run: `cd apps/dashboard && node --test domain/marca-de-agua.test.ts` · Esperado: FAIL (módulo no existe).

- [ ] **Paso 3: implementación mínima**

```ts
// Dominio puro (C3) de ADR-100: desde cuándo se le compra a cada cuenta, cuánto se le pide, y qué
// reels jóvenes se re-miden por URL. Sin IO: la fachada lee las vistas de la `045` y le pasa filas.

export const DIAS_JOVEN = 7;
export const FRACCION_PISO_REMEDIR = 0.25;
export const TOPE_REMEDIR = 200;
export const HOLGURA_CUPO = 1.3;
const DIA_MS = 86_400_000;

/** La misma normalización que escribe `pool_crudo` (backfill y motor): sin `@`, minúsculas. */
export function normalizarHandlePool(h: string): string {
  return String(h ?? "").trim().replace(/^@/, "").toLowerCase();
}

/** D1: `max(marca, ahora − días)`. Sin marca o ilegible, el techo. */
export function desdeDe(watermark: string | null, diasRecencia: number, ahora: Date): string {
  const techo = ahora.getTime() - diasRecencia * DIA_MS;
  const marca = watermark ? Date.parse(watermark) : Number.NaN;
  return new Date(Number.isFinite(marca) ? Math.max(marca, techo) : techo).toISOString();
}

/** D2: el cupo que tapa el hueco. Apify cobra lo que vuelve, así que el piso es inofensivo. */
export function limiteDe(ritmoSemanal: number | null, desde: string, resultadosPorCuenta: number, ahora: Date): number {
  const dias = Math.max(0, (ahora.getTime() - Date.parse(desde)) / DIA_MS);
  const estimado = Math.ceil(((ritmoSemanal ?? 0) * dias / 7) * HOLGURA_CUPO);
  return Math.max(resultadosPorCuenta, estimado);
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SESENTA_Y_CUATRO = BigInt(64);
const CERO = BigInt(0);

/** Media id numérico de Instagram → shortcode. `pool_crudo` no guarda URL. */
export function shortcodeDe(mediaId: string): string | null {
  if (!/^\d+$/.test(mediaId)) return null;
  let n = BigInt(mediaId);
  if (n === CERO) return null;
  let s = "";
  while (n > CERO) {
    s = ALFABETO[Number(n % SESENTA_Y_CUATRO)] + s;
    n = n / SESENTA_Y_CUATRO;
  }
  return s;
}

export type Observacion = {
  external_id: string;
  handle: string;
  publicado_en: string;
  medido_en: string;
  vistas: number;
  edad_al_medir_dias: number;
};
export type ReelARemedir = { external_id: string; handle: string; url: string };

/** D3: lo joven y cerca del piso. Se vacía solo: re-medido, ya no es joven al medirse. */
export function elegirRemedir(
  obs: Observacion[],
  o: { piso: number; diasRecencia: number; handlesActivos: Set<string>; ahora: Date; tope?: number },
): { lista: ReelARemedir[]; cortados: number } {
  const t = o.ahora.getTime();
  const elegibles = obs
    .filter(
      (x) =>
        x.edad_al_medir_dias < DIAS_JOVEN &&
        x.vistas >= o.piso * FRACCION_PISO_REMEDIR &&
        x.vistas < o.piso &&
        t - Date.parse(x.medido_en) >= DIA_MS &&
        t - Date.parse(x.publicado_en) <= o.diasRecencia * DIA_MS &&
        o.handlesActivos.has(normalizarHandlePool(x.handle)) &&
        shortcodeDe(x.external_id) !== null,
    )
    .sort((a, b) => b.vistas - a.vistas);
  const tope = o.tope ?? TOPE_REMEDIR;
  const lista = elegibles.slice(0, tope).map((x) => ({
    external_id: x.external_id,
    handle: normalizarHandlePool(x.handle),
    url: `https://www.instagram.com/reel/${shortcodeDe(x.external_id)}/`,
  }));
  return { lista, cortados: Math.max(0, elegibles.length - tope) };
}

/** Lee un ajuste del plan por clave. Un 0 es un valor, no un faltante. */
export function valorAjuste(ajustes: { fields: Record<string, unknown> }[], clave: string, defecto: number): number {
  const v = ajustes.find((a) => a.fields.clave === clave)?.fields.valor;
  const n = typeof v === "number" ? v : Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? defecto : n;
}
```

- [ ] **Paso 4: correr y ver que pasa.** Run: `node --test domain/marca-de-agua.test.ts` · Esperado: PASS.
  Si `tsc` se queja del literal `3839722324954216054n` del test por el `target`, cambiarlo a
  `BigInt("3839722324954216054")`.

- [ ] **Paso 5:** `npm run typecheck` en verde.

---

### Tarea 3: La fachada sirve la marca de agua

**Archivos:**
- Modificar `apps/dashboard/domain/run-plan.ts` (agregar `conMarcaDeAgua` y tipos)
- Crear `apps/dashboard/lib/marca-de-agua.ts`
- Modificar `apps/dashboard/lib/supabase/scoped.ts` (mapa de granos, junto a `"app.ajustes"`)
- Modificar `apps/dashboard/app/api/engine/run-plan/route.ts`
- Modificar `apps/dashboard/domain/ajustes.ts` (`CATALOGO`)
- Modificar `core/contracts/run-plan.md`
- Test: agregar casos a `apps/dashboard/domain/marca-de-agua.test.ts`

**Consume (Tarea 2):** `desdeDe`, `limiteDe`, `elegirRemedir`, `valorAjuste`, `normalizarHandlePool`, `Observacion`, `ReelARemedir`.

**Produce (lo que lee la Tarea 4):** en el plan de `ambito=motor`:
`referentes[].fields.desde: string | null`, `referentes[].fields.limite: number | null`,
`referentes[].fields.ritmo_semanal: number | null`, `remedir: ReelARemedir[]`,
`marca_de_agua: boolean`, `marca_de_agua_motivo?: string`.

- [ ] **Paso 1: test que falla** (agregar al final de `marca-de-agua.test.ts`; importar
  `conMarcaDeAgua` desde `./run-plan.ts`)

```ts
import { conMarcaDeAgua, type DatosMarcaDeAgua, type RunPlan } from "./run-plan.ts";

describe("conMarcaDeAgua", () => {
  const plan = (ajustes: { clave: string; valor: number }[]): RunPlan => ({
    version: 2, pipeline: "short-form-content", generado_en: AHORA.toISOString(),
    voces: [], proyectos: [],
    referentes: [
      { id: "r1", fields: { handle: "@AskVinh", plataforma: "instagram", proyecto: ["p1"], activo: true } },
      { id: "r2", fields: { handle: "@nueva", plataforma: "instagram", proyecto: ["p1"], activo: true } },
      { id: "r3", fields: { handle: "@tt", plataforma: "tiktok", proyecto: ["p1"], activo: true } },
    ],
    ajustes: ajustes.map((a) => ({ id: a.clave, fields: a })),
  });
  const AJ = [
    { clave: "Días de recencia", valor: 30 },
    { clave: "Resultados por cuenta de referente", valor: 25 },
    { clave: "Mínimo de vistas", valor: 400_000 },
    { clave: "Usar marca de agua", valor: 1 },
  ];
  const datos: DatosMarcaDeAgua = {
    ok: true,
    marcas: [{ handle: "askvinh", watermark: hace(8) }],
    ritmos: [{ handle: "askvinh", ritmo_semanal: 20 }],
    observaciones: [{ external_id: "3839722324954216054", handle: "askvinh", publicado_en: hace(5), medido_en: hace(3), vistas: 200_000, edad_al_medir_dias: 2 }],
  };

  it("cuenta con marca: desde = marca, limite con ritmo", () => {
    const r = conMarcaDeAgua(plan(AJ), datos, AHORA);
    const f = r.referentes[0].fields;
    assert.equal(f.desde, hace(8));
    assert.equal(f.limite, 30); // ceil(20 × 8 ÷ 7 × 1,3) = ceil(29,71) = 30, sobre el piso de 25
    assert.equal(f.ritmo_semanal, 20);
    assert.equal(r.marca_de_agua, true);
    assert.equal(r.remedir.length, 1);
  });
  it("cuenta sin marca: desde = techo, limite = Resultados por cuenta", () => {
    const f = conMarcaDeAgua(plan(AJ), datos, AHORA).referentes[1].fields;
    assert.equal(f.desde, hace(30));
    assert.equal(f.limite, 25);
    assert.equal(f.ritmo_semanal, null);
  });
  it("TikTok no lleva marca", () => {
    const f = conMarcaDeAgua(plan(AJ), datos, AHORA).referentes[2].fields;
    assert.equal(f.desde, null);
    assert.equal(f.limite, null);
  });
  it("interruptor apagado: nada, sin motivo de error", () => {
    const r = conMarcaDeAgua(plan(AJ.map((a) => a.clave === "Usar marca de agua" ? { ...a, valor: 0 } : a)), datos, AHORA);
    assert.equal(r.marca_de_agua, false);
    assert.deepEqual(r.remedir, []);
    assert.equal(r.referentes[0].fields.desde, null);
    assert.equal(r.marca_de_agua_motivo, "apagada en ajustes");
  });
  it("las vistas fallaron: plan sin marca, con motivo, sin abortar", () => {
    const r = conMarcaDeAgua(plan(AJ), { ok: false, error: "timeout" }, AHORA);
    assert.equal(r.marca_de_agua, false);
    assert.deepEqual(r.remedir, []);
    assert.match(r.marca_de_agua_motivo ?? "", /timeout/);
  });
  it("sin Mínimo de vistas: marca sí, re-medición no", () => {
    const r = conMarcaDeAgua(plan(AJ.filter((a) => a.clave !== "Mínimo de vistas")), datos, AHORA);
    assert.equal(r.marca_de_agua, true);
    assert.deepEqual(r.remedir, []);
  });
});
```

- [ ] **Paso 2:** `node --test domain/marca-de-agua.test.ts` · Esperado: FAIL (`conMarcaDeAgua` no existe).

- [ ] **Paso 3: implementar en `domain/run-plan.ts`** (agregar al final; import relativo con `.ts`,
  como el de `pipelines.ts`)

```ts
import {
  desdeDe, elegirRemedir, limiteDe, normalizarHandlePool, valorAjuste,
  type Observacion, type ReelARemedir,
} from "./marca-de-agua.ts";

export type DatosMarcaDeAgua =
  | {
      ok: true;
      marcas: { handle: string; watermark: string | null }[];
      ritmos: { handle: string; ritmo_semanal: number }[];
      observaciones: Observacion[];
    }
  | { ok: false; error: string };

export type RunPlanConMarca = RunPlan & {
  remedir: ReelARemedir[];
  marca_de_agua: boolean;
  marca_de_agua_motivo?: string;
};

/**
 * ADR-100 D4/D6. Aditivo sobre el plan de `ambito=motor`: `version` sigue en 2. Si algo falla, el
 * plan sale igual sin marca y con motivo — perder un ahorro no justifica no entregar.
 */
export function conMarcaDeAgua(plan: RunPlan, datos: DatosMarcaDeAgua, ahora: Date): RunPlanConMarca {
  const sinMarca = (motivo: string): RunPlanConMarca => ({
    ...plan,
    referentes: plan.referentes.map((r) => ({ id: r.id, fields: { ...r.fields, desde: null, limite: null, ritmo_semanal: null } })),
    remedir: [],
    marca_de_agua: false,
    marca_de_agua_motivo: motivo,
  });

  if (valorAjuste(plan.ajustes, "Usar marca de agua", 1) <= 0) return sinMarca("apagada en ajustes");
  if (!datos.ok) return sinMarca(`no se pudo leer la marca de agua (${datos.error})`);

  const dias = valorAjuste(plan.ajustes, "Días de recencia", 7);
  const porCuenta = valorAjuste(plan.ajustes, "Resultados por cuenta de referente", 20);
  const piso = valorAjuste(plan.ajustes, "Mínimo de vistas", 0);
  const marca = new Map(datos.marcas.map((m) => [normalizarHandlePool(m.handle), m.watermark]));
  const ritmo = new Map(datos.ritmos.map((m) => [normalizarHandlePool(m.handle), Number(m.ritmo_semanal)]));
  const esIG = (f: Record<string, unknown>) => String(f.plataforma ?? "").toLowerCase().includes("insta");

  const referentes = plan.referentes.map((r) => {
    if (!esIG(r.fields)) return { id: r.id, fields: { ...r.fields, desde: null, limite: null, ritmo_semanal: null } };
    const h = normalizarHandlePool(String(r.fields.handle ?? ""));
    const desde = desdeDe(marca.get(h) ?? null, dias, ahora);
    const rs = ritmo.has(h) ? (ritmo.get(h) as number) : null;
    return { id: r.id, fields: { ...r.fields, desde, limite: limiteDe(rs, desde, porCuenta, ahora), ritmo_semanal: rs } };
  });

  const activos = new Set(
    plan.referentes.filter((r) => esIG(r.fields)).map((r) => normalizarHandlePool(String(r.fields.handle ?? ""))),
  );
  const remedir = piso > 0
    ? elegirRemedir(datos.observaciones, { piso, diasRecencia: dias, handlesActivos: activos, ahora }).lista
    : [];

  return { ...plan, referentes, remedir, marca_de_agua: true };
}
```

  > Los cortados por el tope no viajan en el plan (YAGNI). El motor ya ve `remedir.length`; si
  > llega a 200 exactos, el aviso lo pone la Tarea 4.

- [ ] **Paso 4:** `node --test domain/marca-de-agua.test.ts` · Esperado: PASS.

- [ ] **Paso 5: `lib/supabase/scoped.ts`.** Agregar al mapa, junto a `"app.ajustes"`:

```ts
  "app.v_watermark_referentes": { esquema: "app", grano: "instancia" },
  "app.v_ritmo_referentes": { esquema: "app", grano: "instancia" },
  "app.v_remedir_candidatos": { esquema: "app", grano: "instancia" },
```

- [ ] **Paso 6: crear `lib/marca-de-agua.ts`.** Seguir el patrón de lectura de `lib/referentes.ts`
  (`const acceso = await scoped(ctx)` y `acceso.select(tabla, columnas)`). Si `scoped` no expone
  `.gte`/`.lt`/`.limit`, filtrar en memoria después: la regla completa igual la aplica
  `elegirRemedir`, el prefiltro SQL solo baja volumen.

```ts
import type { DatosMarcaDeAgua } from "@/domain/run-plan";
import type { TenantContext } from "@/domain/tenant";
import { DIAS_JOVEN } from "@/domain/marca-de-agua";
import { scoped } from "@/lib/supabase/scoped";

// IO de ADR-100: las tres vistas sobre pool_crudo. Nunca tira: si falla, devuelve `ok: false` y la
// fachada sirve el plan sin marca (D6).
export async function leerDatosMarcaDeAgua(ctx: TenantContext, diasRecencia: number, ahora: Date): Promise<DatosMarcaDeAgua> {
  try {
    const acceso = await scoped(ctx);
    const desdeRecencia = new Date(ahora.getTime() - diasRecencia * 86_400_000).toISOString();
    const [marcas, ritmos, obs] = await Promise.all([
      acceso.select("app.v_watermark_referentes", "handle, watermark").eq("plataforma", "instagram"),
      acceso.select("app.v_ritmo_referentes", "handle, ritmo_semanal").eq("plataforma", "instagram"),
      acceso
        .select("app.v_remedir_candidatos", "external_id, handle, publicado_en, medido_en, vistas, edad_al_medir_dias")
        .eq("plataforma", "instagram")
        .gte("publicado_en", desdeRecencia)
        .lt("edad_al_medir_dias", DIAS_JOVEN)
        .limit(5000),
    ]);
    const error = marcas.error ?? ritmos.error ?? obs.error;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      marcas: (marcas.data ?? []) as { handle: string; watermark: string | null }[],
      ritmos: (ritmos.data ?? []).map((r: { handle: string; ritmo_semanal: unknown }) => ({ handle: r.handle, ritmo_semanal: Number(r.ritmo_semanal) })),
      observaciones: (obs.data ?? []).map((o: Record<string, unknown>) => ({
        external_id: String(o.external_id), handle: String(o.handle), publicado_en: String(o.publicado_en),
        medido_en: String(o.medido_en), vistas: Number(o.vistas), edad_al_medir_dias: Number(o.edad_al_medir_dias),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

  ⚠️ Confirmar que `plataforma` en `pool_crudo` se guarda como `'instagram'` (lo escriben el
  backfill y `Preparar pool crudo`: `plataforma: 'instagram'`).

- [ ] **Paso 7: `route.ts`.** Reemplazar la rama de reels:

```ts
    const crudo = await leerRunPlanCrudo(tenant.ctx, ambito);
    const ahora = new Date();
    if (ambito !== "motor") return Response.json(armarRunPlanCompleto(crudo, ahora));
    const base = armarRunPlan(crudo, ahora);
    // ADR-100: la marca de agua es un ahorro. Si falla, el plan sale igual sin marca (D6).
    const datos = await leerDatosMarcaDeAgua(tenant.ctx, valorAjuste(base.ajustes, "Días de recencia", 7), ahora);
    if (!datos.ok) console.error(`[run-plan] marca de agua no disponible: ${datos.error}`);
    return Response.json(conMarcaDeAgua(base, datos, ahora));
```

  con los imports `conMarcaDeAgua` (de `@/domain/run-plan`), `valorAjuste` (de
  `@/domain/marca-de-agua`) y `leerDatosMarcaDeAgua` (de `@/lib/marca-de-agua`).

- [ ] **Paso 8: `domain/ajustes.ts`.** En `CATALOGO`, después de `"Buscar por referentes en TikTok"`:

```ts
  "Usar marca de agua": { consume: "motor", tipo: "toggle" },
```

  Si `domain/ajustes.test.ts` cuenta las claves (18), actualizarlo a 19.

- [ ] **Paso 9: `core/contracts/run-plan.md`.** Nueva sección antes de `## Versionado`:

```markdown
## La marca de agua (ADR-100) — aditivo, `version` sigue en 2

Solo en `?ambito=motor`. Cada referente trae además:

- `fields.desde` — ISO. Desde cuándo comprarle: `max(marca de agua, ahora − Días de recencia)`.
  `null` en TikTok, con el interruptor apagado o si la marca no se pudo leer.
- `fields.limite` — `max(Resultados por cuenta, ceil(ritmo × días ÷ 7 × 1,3))`. `null` en los mismos casos.
- `fields.ritmo_semanal` — reels/semana en los últimos 28 días, o `null` si no hay historia.

Y el plan trae:

- `remedir: [{ external_id, handle, url }]` — reels jóvenes cerca del piso para re-medir por URL.
  Siempre presente; `[]` si no hay o si la marca está apagada.
- `marca_de_agua: boolean` y, cuando es `false`, `marca_de_agua_motivo`.

🔑 **Un fallo leyendo la marca NO devuelve ≠200.** El fail-closed de arriba gobierna lo que rompe
una corrida; la marca de agua es un ahorro, y sin ella el motor compra como antes y lo avisa.
```

- [ ] **Paso 10:** `npm test` y `npm run typecheck` en verde. `npm run build` también (tocaste una ruta).

---

### Tarea 4: El motor usa la marca de agua

**Archivos:** Modificar 4 nodos en `Workflows/workflow-short-form-content/workflow.json` y agregar
casos a `Workflows/workflow-short-form-content/test-nodos.mjs`.

**Consume (Tarea 3):** el plan con `referentes[].fields.desde/limite`, `remedir`, `marca_de_agua`,
`marca_de_agua_motivo`.

**Produce:** en la salida de `Armar plan de corrida`: `ig_pedidos: {url, desde, limite}[]`,
`remedir: {external_id, handle, url}[]`, `marca_de_agua: boolean`. Items de `Split IG referentes`:
`{ urls: string[], tipo: "reels" | "posts", desde: string | null, limite: number }`.

> Editar `jsCode` dentro del JSON es editar un string con `\n` escapados. Recomendado: script
> node de un solo uso que lee el JSON, reemplaza `parameters.jsCode`/`customBody`/`jsonBody` del
> nodo por nombre y lo vuelve a escribir con `JSON.stringify(w, null, 2)`. Comparar el diff: solo
> esos 4 nodos deben cambiar.

- [ ] **Paso 1: tests que fallan.** En `test-nodos.mjs`, extender el helper `runPlan` para aceptar
  campos extra de la fachada:

```js
const runPlan = ({ proyectos = [], vocesActivas = [], referentes = [], ajustes = [], cfg = {}, fachadaExtra = {} } = {}) => {
  const fachada = Object.assign({ version: 1, voces: vocesActivas, proyectos, referentes, ajustes }, fachadaExtra);
  // ... resto igual
```

  y agregar al final (antes del resumen de fallos):

```js
seccion('ADR-100 — marca de agua y re-medición en Armar plan / Split / Apify');
{
  const R = (handle, extra = {}) => ({ id: 'r-' + handle, fields: Object.assign({ handle: '@' + handle, plataforma: 'instagram', proyecto: ['p1'], activo: true }, extra) });
  const base = { proyectos: [P('p1', 'Uno', ['v1'])], vocesActivas: [V('v1', 'Voz')] };
  const REM = [{ external_id: '3839722324954216054', handle: 'cuentaa', url: 'https://www.instagram.com/reel/DVJbxxfCHZ2/' }];

  const conMarca = runPlan({ ...base, referentes: [R('CuentaA', { desde: '2026-09-07T00:00:00.000Z', limite: 40 }), R('cuentab', { desde: '2026-09-01T00:00:00.000Z', limite: 5 })], fachadaExtra: { marca_de_agua: true, remedir: REM } }).plan;
  const pa = conMarca.ig_pedidos.find((x) => /cuentaa/i.test(x.url));
  const pb = conMarca.ig_pedidos.find((x) => /cuentab/i.test(x.url));
  check('con marca: el pedido lleva su desde', pa && pa.desde === '2026-09-07T00:00:00.000Z', JSON.stringify(conMarca.ig_pedidos));
  check('con marca: el limite de la fachada se respeta', pa && pa.limite === 40, JSON.stringify(pa));
  check('con marca: el limite nunca baja de resultados_referente (20)', pb && pb.limite === 20, JSON.stringify(pb));
  check('con marca: remedir pasa', conMarca.remedir.length === 1 && conMarca.marca_de_agua === true, JSON.stringify(conMarca.remedir));

  const topado = runPlan({ ...base, referentes: [R('grande', { desde: '2026-08-20T00:00:00.000Z', limite: 80 })], fachadaExtra: { marca_de_agua: true, remedir: [] } }).plan;
  check('limite sobre cap_resultados_referente (50): se recorta', topado.ig_pedidos[0].limite === 50, JSON.stringify(topado.ig_pedidos));
  check('y avisa nombrando la cuenta', topado.avisos.some((a) => /@grande/.test(a)), JSON.stringify(topado.avisos));

  const sinMarca = runPlan({ ...base, referentes: [R('cuentaa')], fachadaExtra: { marca_de_agua: false, marca_de_agua_motivo: 'no se pudo leer la marca de agua (timeout)', remedir: REM } }).plan;
  check('fachada sin marca: compra como antes', sinMarca.ig_pedidos[0].desde === null && sinMarca.ig_pedidos[0].limite === 20, JSON.stringify(sinMarca.ig_pedidos));
  check('fachada sin marca: no re-mide', sinMarca.remedir.length === 0, JSON.stringify(sinMarca.remedir));
  check('fachada sin marca: avisa con el motivo', sinMarca.avisos.some((a) => /timeout/.test(a)), JSON.stringify(sinMarca.avisos));

  const planViejo = runPlan({ ...base, referentes: [R('cuentaa')] }).plan;
  check('plan viejo (sin campos nuevos): compra como antes, sin romper', planViejo.ig_pedidos[0].desde === null && planViejo.remedir.length === 0, JSON.stringify(planViejo));

  const apagado = runPlan({ ...base, referentes: [R('cuentaa', { desde: '2026-09-07T00:00:00.000Z', limite: 40 })], ajustes: [{ id: 'x', fields: { clave: 'Usar marca de agua', valor: 0 } }], fachadaExtra: { marca_de_agua: true, remedir: REM } }).plan;
  check('interruptor apagado en el motor: compra como antes y no re-mide', apagado.ig_pedidos[0].desde === null && apagado.remedir.length === 0, JSON.stringify(apagado));

  // Split IG referentes
  const split = (plan) => new Function('$', jsCode('Split IG referentes'))((n) => {
    if (n === 'Armar plan de corrida') return { first: () => ({ json: plan }) };
    throw new Error('nodo no mockeado: ' + n);
  });
  const items = split(conMarca);
  check('Split: un item por cuenta + uno de re-medición', items.length === conMarca.ig_pedidos.length + 1, JSON.stringify(items));
  const ultimo = items[items.length - 1].json;
  check('Split: el item de re-medición es posts, limite 1, sin fecha', ultimo.tipo === 'posts' && ultimo.limite === 1 && ultimo.desde === null && ultimo.urls[0] === REM[0].url, JSON.stringify(ultimo));
  check('Split: sin remedir no agrega item', split(sinMarca).length === sinMarca.ig_pedidos.length, JSON.stringify(split(sinMarca)));

  // Apify — IG Reels: el customBody es una expresión ={{ ... }}
  const exprBody = w.nodes.find((x) => x.name === 'Apify — IG Reels').parameters.customBody;
  const cuerpo = (plan, item) => new Function('$', '$json', 'return ' + exprBody.replace(/^=\{\{\s*/, '').replace(/\s*\}\}\s*$/, ''))(
    (n) => ({ first: () => ({ json: plan }) }), item);
  const bReels = cuerpo(conMarca, items[0].json);
  check('Body reels con marca: onlyPostsNewerThan = desde, resultsLimit = limite', bReels.resultsType === 'reels' && bReels.onlyPostsNewerThan === items[0].json.desde && bReels.resultsLimit === items[0].json.limite, JSON.stringify(bReels));
  const bViejo = cuerpo(Object.assign({}, sinMarca, { dias_recencia: 30 }), split(sinMarca)[0].json);
  check('Body reels sin marca: onlyPostsNewerThan relativo', bViejo.onlyPostsNewerThan === '30 days', JSON.stringify(bViejo));
  const bPosts = cuerpo(conMarca, ultimo);
  check('Body re-medición: posts, limite 1, sin fecha ni searchType', bPosts.resultsType === 'posts' && bPosts.resultsLimit === 1 && !('onlyPostsNewerThan' in bPosts) && !('searchType' in bPosts), JSON.stringify(bPosts));
}
```

- [ ] **Paso 2:** `node Workflows/workflow-short-form-content/test-nodos.mjs` · Esperado: los checks
  nuevos en ❌, los viejos en ✅.

- [ ] **Paso 3: `Armar plan de corrida`.** Tres cambios en el `jsCode`:

  (a) En `AJUSTE_MAP`, agregar `'usar marca de agua':'usar_marca_agua'`.

  (b) Antes de `referentes.forEach`, declarar `const pedidoPorHandle = {};` y, dentro del
  `forEach`, después de calcular `handle` y `plat`:

```js
  if (plat.indexOf('insta') >= 0) pedidoPorHandle[handle.toLowerCase()] = { desde: f.desde || null, limite: Number(f.limite) || 0 };
```

  (c) Después del bloque que arma `ig_urls`, y antes del `return`:

```js
// ADR-100: marca de agua + re-medición. La fachada calcula; acá solo se aplica y se recorta.
// Apagado, fachada sin marca, o referente sin `desde`: se compra como antes (ventana fija).
const MARCA_PEDIDA = Number(pick('usar_marca_agua', 1)) > 0;
const USAR_MARCA = MARCA_PEDIDA && plan.marca_de_agua === true;
if (MARCA_PEDIDA && plan.marca_de_agua !== true && ig_urls.length) {
  const _a = 'La marca de agua no se aplicó (' + (plan.marca_de_agua_motivo || 'la fachada no la mandó') + '). Se compró como antes, con ventana de ' + dias_recencia + ' días.';
  avisos.push(_a); console.log('[Plan] ⚠️ ' + _a);
}
const ig_pedidos = [...new Set(ig_urls)].map(url => {
  const h = url.replace('https://www.instagram.com/', '').replace(/\/$/, '').toLowerCase();
  const m = pedidoPorHandle[h] || {};
  if (!USAR_MARCA || !m.desde) return { url, desde: null, limite: resultados_referente };
  let limite = Math.max(resultados_referente, m.limite || 0);
  if (cap_rr > 0 && limite > cap_rr) {
    const _a = '@' + h + ' necesitaba ' + limite + ' reels desde su última compra y el tope del motor lo baja a ' + cap_rr + '. Lo publicado entre medio no se compra; para subirlo hay que mover cap_resultados_referente en el Config.';
    avisos.push(_a); console.log('[Plan] ⚠️ ' + _a);
    limite = cap_rr;
  }
  return { url, desde: m.desde, limite };
});
const remedir = (USAR_MARCA && BUSCAR_REF_IG) ? (plan.remedir || []).filter(r => r && r.url) : [];
if (remedir.length >= 200) {
  const _a = 'Se re-miden ' + remedir.length + ' reels jóvenes, el tope de la corrida. Pueden haber quedado más afuera.';
  avisos.push(_a); console.log('[Plan] ⚠️ ' + _a);
}
```

  y en el objeto del `return` agregar `ig_pedidos, remedir, marca_de_agua: USAR_MARCA`.

- [ ] **Paso 4: `Split IG referentes`.** Reemplazar el `jsCode` entero:

```js
// ADR-100: un item por cuenta IG (cada uno con su desde/limite) y, si hay, UN item más con los
// reels jóvenes a re-medir por URL. `Apify — IG Reels` corre una vez por item.
const p = $('Armar plan de corrida').first().json;
const out = (p.ig_pedidos || []).map(x => ({ json: { urls: [x.url], tipo: 'reels', desde: x.desde, limite: x.limite } }));
const remedir = p.remedir || [];
if (remedir.length) out.push({ json: { urls: remedir.map(r => r.url), tipo: 'posts', desde: null, limite: 1 } });
return out;
```

- [ ] **Paso 5: `Apify — IG Reels`.** Reemplazar `parameters.customBody`:

```
={{ (function(){ var p=$('Armar plan de corrida').first().json; var j=$json; var d=Number(p.dias_recencia||0); var b={ directUrls: j.urls, resultsType: j.tipo, resultsLimit: j.limite }; if (j.tipo === 'reels') { b.searchType='user'; b.searchLimit=1; b.addParentData=true; if (j.desde) b.onlyPostsNewerThan = j.desde; else if (d>0) b.onlyPostsNewerThan = d + ' days'; } else { b.addParentData=false; } return b; })() }}
```

- [ ] **Paso 6: `Etapa: colecta`.** En el `jsonBody`, dentro de `params`, agregar después de
  `referentes: ...`:

```
marca_de_agua: !!p.marca_de_agua, remedir: (p.remedir || []).length, pedido_ig: (p.ig_pedidos || []).reduce(function(s, x){ return s + (x.limite || 0); }, 0),
```

- [ ] **Paso 7:** `node Workflows/workflow-short-form-content/test-nodos.mjs` · Esperado: todo ✅.
- [ ] **Paso 8:** `node Workflows/auditar-workflows.mjs` · Esperado: sin hallazgos nuevos.
- [ ] **Paso 9:** `cd core/scripts && npm run validate` en verde.

---

### Tarea 5: Revisión cruzada del código (la hace Claude, no Kiro)

- [ ] `git diff --stat`: solo los archivos del mapa.
- [ ] Re-correr: `npm test`, `npm run typecheck`, `npm run build` (dashboard), `test-nodos.mjs`,
  `auditar-workflows.mjs`, `npm run validate`.
- [ ] Revisar que `n8n:diff` muestre drift **solo** en los 4 nodos.
- [ ] Commit en español directo a `main`.

### Tarea 6: Llevarlo a producción (gates humanos, en este orden)

0. **Mani aplica la `043`** (ADR-097, escrita desde el 11/09): sin su trigger, un cambio de piso
   por SQL no mueve `actualizado_en` y el rescate de ADR-100 §D3.1 no se dispara. Verificar con
   `select tgname from pg_trigger where tgrelid = 'app.ajustes'::regclass and not tgisinternal`.
1. **Mani aplica la `045`** en el SQL Editor. Claude la verifica por efecto con las consultas a-e.
2. **Deploy del dashboard** (según `apps/dashboard/README.md`). Verificar: `GET
   /api/engine/run-plan?ambito=motor&instancia=<uuid>` con el header trae `marca_de_agua: true`,
   `desde`/`limite` en los referentes IG y `remedir` con del orden de decenas.
   *El motor viejo ignora los campos nuevos, así que este deploy solo no cambia nada.*
3. **`n8n:push -- motor --nodos "Armar plan de corrida,Split IG referentes,Apify — IG Reels,Etapa: colecta"`**
   en dry-run, revisarlo, después `--apply`, y `n8n:diff` verde.
4. **Mani confirma la corrida real** (cuesta). Antes, Mani baja `Días de recencia` a 30 desde el
   cockpit.
5. **Medir después** (y escribirlo en el cierre del handoff):
   - `runs.params`: `marca_de_agua = true`, `pedido_ig`, `remedir`.
   - Reels comprados (por `chargedEventCounts`, no `usageTotalUsd`) contra ~600 esperados.
   - `select count(*) from app.pool_crudo where origen = 'motor'` > 0.
   - De los re-medidos, cuántos cruzaron el piso ese día.
   - Rescate (§D3.1): cuántos de los ~102 entraron a `remedir`, cuántos llegaron a candidato, y que
     en la corrida siguiente **no** vuelvan a aparecer (la regla se apaga sola).

> **Agregado en la revisión (15/09):** el rescate por cambio de piso (ADR-100 §D3.1) lo implementó
> Claude después de la Tarea 5: `elegirRemedir` recibe `pisoCambioEn`, `fechaAjuste` lo lee del
> plan, `lib/ajustes.ts` pasa `actualizado_en` y `lib/marca-de-agua.ts` ya no filtra por edad.
   - `runs.metricas.avisos`: ningún aviso de "no se aplicó".

**Rollback:** `Usar marca de agua = 0` desde el cockpit (instantáneo, sin deploy). Si el motor
mismo falla: `npm run n8n:restore -- motor <snapshot> --apply`.
