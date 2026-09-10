import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  CASOS_COBERTURA, coberturaDeSegmentos, textoDeSegmentos, veredictoCobertura,
} from "./cobertura.ts";

describe("coberturaDeSegmentos", () => {
  it("es el fin del último segmento, en segundos", () => {
    assert.equal(coberturaDeSegmentos([{ text: "a", offset: 0, duration: 3520 },
                                        { text: "b", offset: 14760, duration: 2760 }]), 17.5);
  });
  it("sin segmentos no inventa un cero", () => {
    assert.equal(coberturaDeSegmentos([]), null);
  });
});

describe("textoDeSegmentos", () => {
  it("une con UN espacio y nada más", () => {
    assert.equal(textoDeSegmentos([{ text: "hola", offset: 0, duration: 1 },
                                   { text: "mundo", offset: 1, duration: 1 }]), "hola mundo");
  });
});

describe("veredictoCobertura", () => {
  it("sin duración no juzga: 'desconocido', nunca 'parcial'", () => {
    assert.equal(veredictoCobertura(29, null, 0.8), "desconocido");
    assert.equal(veredictoCobertura(null, 45.8, 0.8), "desconocido");
  });
  it("un video callado no es un video cortado (DaTf9Wqxt8p, medido 09/09)", () => {
    assert.equal(veredictoCobertura(53.2, 54.0, 0.8), "completo");
  });
  it("cubrir 29s de 45.8s es parcial (Day8CXdBLwK, medido 09/09)", () => {
    assert.equal(veredictoCobertura(29.0, 45.8, 0.8), "parcial");
  });
  it("cubrir 41.5s de 150.4s es parcial (Db9Y_EGulGk, medido 09/09)", () => {
    assert.equal(veredictoCobertura(41.5, 150.4, 0.8), "parcial");
  });
  it("cobertura mayor que la duración no rompe: es completo", () => {
    assert.equal(veredictoCobertura(46.2, 45.8, 0.8), "completo");
  });
  it("en el borde exacto (cobertura === duracion * umbral), >= incluye la igualdad", () => {
    assert.equal(veredictoCobertura(40, 50, 0.8), "completo");
  });
});

describe("CASOS_COBERTURA", () => {
  it("cada caso dice qué veredicto espera, para que test-nodos.mjs corra la misma tabla", () => {
    for (const c of CASOS_COBERTURA) {
      assert.equal(veredictoCobertura(c.cobertura, c.duracion, c.umbral), c.espera, c.nombre);
    }
  });
});
