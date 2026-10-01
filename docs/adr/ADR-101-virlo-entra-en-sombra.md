# ADR-101 — Virlo entra en sombra

> **Estado:** **Reemplazada por [ADR-102](./ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md)** (2026-10-01): Virlo no replica el roster, busca por temática. Era: **Propuesta** (2026-09-28). Se acepta con los números de la Fase 0 de
> [plan-migracion-virlo.md](../agents/plan-migracion-virlo.md), que todavía no existen porque falta
> la API key. **Enmienda [ADR-098](./ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md)**, que
> decidió "Apify se queda".
> **Toca `core/`**: migración `046_proveedor_virlo.sql` (borrada en T0 de docs/virlo/07; queda en git, commit d1de681) (clave de ajuste,
> `pool_crudo.proveedor`, vistas de marca de agua filtradas a Apify, `videos_meta.fuente`, tarifas).
> No toca el contrato `run-plan.md`: el ajuste viaja por `ajustes[]`, como cualquier otro.

## Contexto

1. **La dirección cambió, no el precio.** ADR-098 comparó proveedores por lo que cuestan por reel y
   concluyó que ninguno ahorraba lo suficiente para justificar el remapeo. El 25/09 Mani cambió la
   pregunta: el cockpit pasa a ser el tracker de la operación de media y **el scraping se
   terceriza**. El argumento ya no es ahorrar, es dejar de mantener scraping propio (roster a mano,
   marca de agua, re-medición, pool crudo).
2. **Virlo trae cosas que Apify no** (docs revisadas el 28/09 + llamada con Nick ese día): agents
   que buscan por nicho sin depender de un roster, tracking de creadores con vistas en el tiempo,
   un filtro de intención propio, y 79 campos de análisis por video.
3. **Pero sale más caro por el camino de hoy.** El creator lookup cuesta 0,50 USD por referente, así
   que las 83 cuentas medidas en pool_crudo (28/09) son ~41 USD por corrida, contra 1 a 6 USD que cuesta hoy con Apify
   (costos §3.3).
4. **Y no está probado que reemplace a Supadata.** En la llamada se dijo que con Data Intelligence
   entregan el transcript. La doc y el OpenAPI no exponen el texto en ningún campo: solo
   `transcript_word_count`. ADR-095 además exige cobertura en segundos.

## Decisión

**D1 — Virlo entra al lado, nunca en lugar, hasta que gane con datos.** Un ajuste `Proveedor de
scraping`: **0** Apify (default) · **1** sombra (entrega Apify, Virlo corre y solo se registra) ·
**2** entrega Virlo. El rollback es poner un 0, sin deploy, igual que `Usar marca de agua` (ADR-100 D6).

**D2 — La sombra no puede mover lo que se compra.** Las observaciones de Virlo van a `pool_crudo`
con `proveedor = 'virlo'`, y las tres vistas de marca de agua leen **solo** `apify`. Sin ese filtro,
un reel que ve Virlo corre la marca de agua de la cuenta, Apify deja de comprarlo y el flujo real lo
pierde sin error.

**D3 — Virlo desemboca en la forma interna de `Normalizar IG`.** Mismo `external_id` (el media id
numérico de IG, derivado del shortcode si Virlo no lo da), así que dedup, caché de transcripts,
`videos_meta`, gate y candidatos no se tocan.

**D4 — Supadata no se toca hasta que una corrida real muestre texto de transcript en Virlo.** Si lo
trae, entra como caché previa a Supadata (Fase 5), y Supadata queda de respaldo.

**D5 — El cockpit sigue con Apify y Supadata para lo que pide por URL suelta** (colecciones,
pantalla Transcribir): el único equivalente en Virlo cuesta 0,50 USD por video.

## Lo que esta ADR NO decide

- **Qué endpoint trae los reels de los referentes** (lookup cada corrida o tracking semanal): lo
  decide la Fase 0 con costo y cobertura medidos.
- **Si los agents por nicho entran como carril nuevo** (Fase 4): depende del volumen medido.
- **El corte** (Fase 6): requiere 2–3 corridas en sombra con el criterio de pase del plan cumplido
  y el precio negociado con Virlo.

## Consecuencias

- (+) La migración se puede revertir en cada paso, y no hay una fecha en la que todo cambie junto.
- (+) La sombra produce la comparación que ADR-098 hizo con precios de lista, esta vez con reels
  reales del roster.
- (−) Durante la sombra se paga dos veces el scraping.
- (−) Las vistas de marca de agua quedan atadas a `'apify'` en SQL: el corte necesita otra migración.
