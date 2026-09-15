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
    const obs = [150_000, 390_000, 250_000].map((v, i) => ({ ...base, external_id: String(BigInt("3839722324954216054") + BigInt(i)), vistas: v }));
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
