# ADR-102 — La búsqueda pasa a Virlo: el agente por temática, y Claude asigna

> **Estado:** **Aceptada** (Mani, grill del 2026-10-01). La Fase 0 de
> [docs/virlo/00-plan.md](../virlo/00-plan.md) es su verificación: si el equipo aprueba < 10 % de lo
> que trae Virlo, esta ADR se revierte (es ADR-019 otra vez).
> **Reemplaza a [ADR-101](./ADR-101-virlo-entra-en-sombra.md)** (que replicaba el roster en Virlo).
> **Enmienda** [ADR-019](./ADR-019-remocion-total-eje-keyword.md) (el eje por tema vuelve, con
> intención), [ADR-098](./ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md) (Apify deja de
> ser el buscador), [ADR-013](./ADR-013-atribucion-multiproyecto-fan-out.md) (un video va a **un
> solo** proyecto, no a cada uno que lo reclama) y
> [ADR-015](./ADR-015-busqueda-solo-referente-retiro-keywords.md) (la búsqueda deja de ser solo por referente).
> **Toca `core/`**: la `046` se reescribe (ver [07 · T0](../virlo/07-refactor-tickets.md)).
> Plan de ejecución: [docs/virlo/07-refactor-tickets.md](../virlo/07-refactor-tickets.md).

## Contexto

1. **El techo es el roster, no el proveedor** ([costos.md §4.1.1](../costos.md)): con el piso de
   500k, 78 cuentas dan 0,6 a 2,3 aprobados por semana contra ~300 pedidos. Cambiar Apify por otro
   scraper del mismo roster no lo mueve.
2. **Virlo cambia el eje:** sus agentes buscan por tema en cualquier cuenta, filtran por intención
   con IA, se agendan solos, avisan por webhook y traen el transcript gratis (01/10).
3. **Un agente rinde con keywords de UNA idea.** Virlo midió en ~11.000 corridas que 7 a 12 keywords
   del mismo tema son lo que menos se descarta. Una voz con 7 proyectos son 7 ideas: el "agente por
   voz" del 28/09 quedaba con una intención difusa.
4. **El gate actual no puede asignar** ([plan-refactor-motor §3bis](../agents/plan-refactor-motor.md)):
   califica cada par (video × proyecto) con la prosa de ese proyecto, y 15 escalas no se comparan.

## Decisión

- **D1 — El centro es el Agente, una temática.** Lo crea y lo opera el equipo de media desde el
  cockpit (intención en el formato de Virlo, 7 a 12 keywords) y le asocia proyectos **de cualquier
  voz**. El Proyecto deja de buscar: es un destino con su N, sus criterios y las plataformas que acepta.
- **D2 — Claude asigna.** Una llamada por video ve el video y los proyectos elegibles y responde a
  cuál va **o "ninguno"**. **Un video va a un solo proyecto** (Majo, 01/10), en proporción al N. Lo
  que Virlo marca `intent_match: false` se descarta antes, visible. Reemplaza al gate.
- **D3 — Todo el carril vive en el cockpit**: agentes, ingesta por webhook, asignación, libro de gasto.
  El motor de n8n sigue con Apify **sin un cambio** hasta el corte, como sombra y rollback.
- **D4 — Sin tope de gasto, con libro propio.** Media opera libre; cada acción va a `app.eventos`, y
  se registran el costo de cada corrida y el saldo. Recarga automática en Virlo, porque si el saldo
  toca cero Virlo pausa los agentes y recargar no los reactiva.
- **D5 — El resto** (idiomas, plataformas por proyecto, autopilot, umbral por agente, sombra a
  ciegas, Data Intelligence obligatoria) está en [00 §3](../virlo/00-plan.md), D-5 a D-11.

## Consecuencias

- (+) La búsqueda deja de depender de un roster cargado a mano; el equipo opera temas, no cuentas.
- (+) Asignar comparando cuesta menos llamadas que puntuar pares (hoy ~1,9 por video).
- (−) **El norte del ROADMAP se mueve** ("busca videos de referentes"): enmienda escrita en ROADMAP §1.
- (−) YouTube entra como plataforma: el enum `app.plataforma` y el `external_id` necesitan su regla.
- (−) Dos fuentes al mismo Feed durante el piloto; el dedup por `external_id` es lo que las separa.
- **Apagar n8n entero** (motor, descubrimiento, archivado, dispatcher) se vuelve posible después del
  corte, pero es otra ADR.
