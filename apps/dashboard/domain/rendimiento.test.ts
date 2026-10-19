import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  contraSuEdad,
  etiquetaDe,
  validarEtiquetaRendimiento,
  vpd,
  type EtiquetaRendimiento,
} from "./rendimiento.ts";

const etiquetas: EtiquetaRendimiento[] = [
  { id: "muy", nombre: "muy bueno", metrica: "vpd", minimo: 20000 },
  { id: "bueno", nombre: "bueno", metrica: "vpd", minimo: 5000 },
  { id: "bajo", nombre: "bajo", metrica: "vpd", minimo: 0 },
];

describe("vpd", () => {
  it("divide por días fraccionarios de vida", () => {
    assert.equal(vpd(3000, "2026-10-17T00:00:00Z", "2026-10-18T12:00:00Z"), 2000);
  });
  it("una publicación del mismo día usa un día", () => {
    assert.equal(vpd(3000, "2026-10-18T10:00:00Z", "2026-10-18T12:00:00Z"), 3000);
  });
  it("sin vistas o fecha devuelve null", () => {
    assert.equal(vpd(null, "2026-10-18T10:00:00Z", "2026-10-18T12:00:00Z"), null);
    assert.equal(vpd(3000, null, "2026-10-18T12:00:00Z"), null);
  });
});

describe("etiquetaDe", () => {
  it("elige el mínimo más alto que alcanza", () => {
    assert.equal(etiquetaDe(19999, etiquetas)?.nombre, "bueno");
  });
  it("el mínimo exacto entra en la etiqueta", () => {
    assert.equal(etiquetaDe(20000, etiquetas)?.nombre, "muy bueno");
  });
  it("debajo del mínimo más bajo o sin etiquetas devuelve null", () => {
    assert.equal(etiquetaDe(10, etiquetas.slice(0, 2)), null);
    assert.equal(etiquetaDe(10, []), null);
  });
});

describe("contraSuEdad", () => {
  it("aplica los cortes de cada franja", () => {
    assert.equal(contraSuEdad(70000, 3), "top 10 %");
    assert.equal(contraSuEdad(15000, 10), "top 25 %");
    assert.equal(contraSuEdad(1500, 20), "top 50 %");
    assert.equal(contraSuEdad(249, 51), "mitad de abajo");
  });
});

describe("validarEtiquetaRendimiento", () => {
  it("recorta el nombre y acepta un entero no negativo", () => {
    assert.deepEqual(validarEtiquetaRendimiento("  excelente  ", 30000, etiquetas), {
      ok: true, nombre: "excelente", minimo: 30000,
    });
  });
  it("rechaza nombre y mínimo duplicados", () => {
    const nombre = validarEtiquetaRendimiento("bueno", 9000, etiquetas);
    const minimo = validarEtiquetaRendimiento("otro", 5000, etiquetas);
    assert.equal(nombre.ok, false);
    assert.equal(minimo.ok, false);
    if (!nombre.ok) assert.match(nombre.mensaje, /nombre/);
    if (!minimo.ok) assert.match(minimo.mensaje, /mínimo/);
  });
  it("rechaza mínimos negativos o no enteros", () => {
    assert.equal(validarEtiquetaRendimiento("otro", -1, etiquetas).ok, false);
    assert.equal(validarEtiquetaRendimiento("otro", 1.5, etiquetas).ok, false);
  });
});
