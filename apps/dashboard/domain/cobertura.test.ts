import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  avisoDeCobertura, CASOS_COBERTURA, CASOS_RESPUESTA, CASOS_SEGMENTOS, coberturaDeRespuesta,
  coberturaDeSegmentos, duracionOpcional, textoDeRespuesta, textoDeSegmentos, veredictoCobertura,
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

describe("avisoDeCobertura", () => {
  it("un parcial dice cuánto cubre de cuánto dura, redondeado a segundos enteros", () => {
    assert.equal(avisoDeCobertura("parcial", 29, 45.8), "Guion incompleto: cubre 29 s de 46 s");
  });
  it("completo no dibuja nada", () => {
    assert.equal(avisoDeCobertura("completo", 53.2, 54.0), null);
  });
  it("desconocido no dibuja nada: no hay que asustar a Majo por una duración que no llegó", () => {
    assert.equal(avisoDeCobertura("desconocido", 29, null), null);
    assert.equal(avisoDeCobertura("desconocido", null, 45.8), null);
  });
});

describe("textoDeRespuesta / coberturaDeRespuesta", () => {
  it("con `content: []` y `text` usa el texto: manda el contenido, no el contenedor", () => {
    // 🩸 El bug mudo del review final: `Array.isArray([])` es `true`, así que el nodo entraba a la
    // rama de segmentos, sacaba "" y NUNCA miraba `text`. El mismo video daba guion en el cockpit
    // y "sin voz" en el motor.
    assert.equal(textoDeRespuesta({ content: [], text: "el fallback" }), "el fallback");
    assert.equal(coberturaDeRespuesta({ content: [], text: "el fallback" }), null);
  });
  it("con segmentos de verdad no mira el fallback", () => {
    const cuerpo = { content: [{ text: "de segmentos", offset: 0, duration: 20000 }], text: "no" };
    assert.equal(textoDeRespuesta(cuerpo), "de segmentos");
    assert.equal(coberturaDeRespuesta(cuerpo), 20);
  });
  it("conserva la forma vieja (content string) sin cobertura", () => {
    assert.equal(textoDeRespuesta({ content: "viejo" }), "viejo");
    assert.equal(coberturaDeRespuesta({ content: "viejo" }), null);
  });
  it("un cuerpo sin nada útil da texto vacío y no tira", () => {
    assert.equal(textoDeRespuesta({}), "");
    assert.equal(textoDeRespuesta(null), "");
    assert.equal(coberturaDeRespuesta(null), null);
  });
});

describe("duracionOpcional", () => {
  it("deja pasar la duración cuando la búsqueda anda", async () => {
    assert.equal(await duracionOpcional(async () => 45.8), 45.8);
    assert.equal(await duracionOpcional(async () => null), null);
  });
  it("🔴 una búsqueda que TIRA no puede tumbar lo que ya se pagó (ADR-095 §3.5)", async () => {
    // Sin esto, un 5xx de Supabase buscando la duración perdía el transcript de Supadata y la
    // traducción de Haiku, y la fila quedaba en `fallo`. El peor caso tiene que ser el
    // comportamiento anterior: sin duración, sin aviso, y el guion guardado igual.
    assert.equal(await duracionOpcional(async () => { throw new Error("PostgREST 503"); }), null);
    assert.equal(await duracionOpcional(() => Promise.reject(new Error("red caída"))), null);
    assert.equal(await duracionOpcional(() => { throw new Error("sincrónico"); }), null);
  });
});

// Las tres tablas que `test-nodos.mjs` corre contra la COPIA TEXTUAL del nodo. Acá se corren contra
// el original: si una tabla y su función no coinciden de este lado, el pinzado no prueba nada.

describe("CASOS_COBERTURA", () => {
  it("cada caso dice qué veredicto espera, para que test-nodos.mjs corra la misma tabla", () => {
    for (const c of CASOS_COBERTURA) {
      assert.equal(veredictoCobertura(c.cobertura, c.duracion, c.umbral), c.espera, c.nombre);
    }
  });
});

describe("CASOS_SEGMENTOS", () => {
  it("cada caso fija el texto Y la cobertura de los mismos segmentos", () => {
    for (const c of CASOS_SEGMENTOS) {
      const segs = c.segs as Parameters<typeof textoDeSegmentos>[0];
      assert.equal(textoDeSegmentos(segs), c.texto, c.nombre);
      assert.equal(coberturaDeSegmentos(segs), c.cobertura, c.nombre);
    }
  });
});

describe("CASOS_RESPUESTA", () => {
  it("cada caso fija qué rama gana (segmentos / string / text)", () => {
    for (const c of CASOS_RESPUESTA) {
      // `cuerpo` es `unknown` en la tabla a propósito: los casos degenerados (un `{error}`, el
      // `{jobId}` del 202) no tienen forma de respuesta, y son justo los que importa fijar.
      const cuerpo = c.cuerpo as Parameters<typeof textoDeRespuesta>[0];
      assert.equal(textoDeRespuesta(cuerpo), c.texto, c.nombre);
      assert.equal(coberturaDeRespuesta(cuerpo), c.cobertura, c.nombre);
    }
  });
});
