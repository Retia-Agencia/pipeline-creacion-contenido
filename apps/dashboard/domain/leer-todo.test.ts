import { test } from "node:test";
import assert from "node:assert/strict";
import { leerTodo, TOPE_POSTGREST } from "../lib/supabase/tope.ts";

// Simula PostgREST: sirve `total` filas y corta cada página en el tope, como en prod.
const servidor = (total: number) => async (d: number, h: number) => {
  const filas = Array.from({ length: total }, (_, i) => i).slice(d, Math.min(h + 1, d + TOPE_POSTGREST));
  return { data: filas, error: null };
};

test("trae las 1.002 filas que antes tiraban el cockpit", async () => {
  assert.equal((await leerTodo(servidor(1002), "x")).length, 1002);
});

test("justo en el tope pide una página más y termina", async () => {
  assert.equal((await leerTodo(servidor(2000), "x")).length, 2000);
});

test("bajo el tope y vacío", async () => {
  assert.equal((await leerTodo(servidor(5), "x")).length, 5);
  assert.equal((await leerTodo(servidor(0), "x")).length, 0);
});

test("un error de Supabase aborta con contexto", async () => {
  await assert.rejects(
    leerTodo(async () => ({ data: null, error: { message: "boom" } }), "los limpios"),
    /los limpios.*boom/,
  );
});
