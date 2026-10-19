import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { avisoCorridaRepetida, corridaDeHoy } from "./corrida-repetida.ts";
import type { Corrida } from "./corrida.ts";

const run = (inicio: string, estado: Corrida["estado"] = "ok"): Corrida => ({
  id: inicio,
  inicio,
  fin: null,
  estado,
  trigger_type: "manual",
  metricas: null,
  error: null,
  params: { workflow: "motor" },
});

// 2026-10-18 15:00 en Bogotá (UTC-5) = 20:00Z
const AHORA = new Date("2026-10-18T20:00:00Z");

describe("corridaDeHoy", () => {
  it("encuentra una corrida terminada del mismo día", () => {
    assert.equal(corridaDeHoy([run("2026-10-18T14:00:00Z")], AHORA)?.inicio, "2026-10-18T14:00:00Z");
  });
  it("la de ayer no cuenta", () => {
    assert.equal(corridaDeHoy([run("2026-10-17T14:00:00Z")], AHORA), null);
  });
  it("el día es el de Bogotá, no el de UTC", () => {
    // 02:00Z del 19 = 21:00 del 18 en Bogotá: es hoy
    assert.notEqual(corridaDeHoy([run("2026-10-19T02:00:00Z")], new Date("2026-10-19T03:00:00Z")), null);
    // 04:00Z del 18 = 23:00 del 17 en Bogotá: no es hoy
    assert.equal(corridaDeHoy([run("2026-10-18T04:00:00Z")], AHORA), null);
  });
  it("una corrida que falló no trajo ni gastó en vano: no cuenta", () => {
    assert.equal(corridaDeHoy([run("2026-10-18T14:00:00Z", "fallo")], AHORA), null);
  });
  it("parcial cuenta", () => {
    assert.notEqual(corridaDeHoy([run("2026-10-18T14:00:00Z", "parcial")], AHORA), null);
  });
  it("devuelve la más reciente", () => {
    const r = corridaDeHoy([run("2026-10-18T13:00:00Z"), run("2026-10-18T16:00:00Z")], AHORA);
    assert.equal(r?.inicio, "2026-10-18T16:00:00Z");
  });
});

describe("avisoCorridaRepetida", () => {
  it("dice cuándo corrió y cuánto cuesta", () => {
    const t = avisoCorridaRepetida("2026-10-18T14:00:00Z", 0.81, AHORA);
    assert.match(t, /ya corrió hoy/);
    assert.match(t, /hace 6 h/);
    assert.match(t, /0,81 USD/);
    assert.match(t, /nada nuevo/);
  });
  it("sin costo calculado no inventa cifra", () => {
    const t = avisoCorridaRepetida("2026-10-18T14:00:00Z", null, AHORA);
    assert.doesNotMatch(t, /USD/);
    assert.match(t, /cuesta igual/);
  });
});
