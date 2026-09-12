# Archivo de docs

Planes **ya ejecutados** y documentos de sistemas **que ya no existen**. Se movieron acá el
**2026-09-12**, en dos tandas (la auditoría de la mañana y la consolidación de la tarde), para que
`docs/agents/` contenga solo lo vivo.

**La regla que los trae acá:** un plan mezcla cuatro cosas que envejecen a velocidades distintas
—estado, decisiones, mediciones y diseño— así que el conjunto se pudre a la velocidad de la parte
más rápida. Cuando un plan se ejecuta **se desarma en los cuatro**: las decisiones a
[`docs/adr/`](../adr/), las mediciones a [`docs/experimentos/`](../experimentos/), el estado al
[handoff](../agents/handoff.md), y el archivo acá.

**No se borraron, y la razón importa:** git conserva el contenido igual, pero borrar pierde la
capacidad de *encontrarlo* cuando alguien pregunte "¿por qué esta pantalla ordena así?". Mover
cuesta lo mismo y no tiene downside.

| archivo | líneas | por qué está acá |
|---|---|---|
| [plan-orden-y-filtro.md](./plan-orden-y-filtro.md) | 1.305 | ✅ Ejecutado y live el 2026-08-26, las 7 tareas cerradas y desplegadas. Lo que sigue vigente son sus decisiones, y esas viven en [ADR-076](../adr/ADR-076-ordenar-es-una-vista-no-una-consulta.md) |
| [mapa-campos.md](./mapa-campos.md) | 637 | 🪦 Mapea la base de **Airtable**, purgada el 2026-08-03. Sirve para saber qué campo servía para qué y por qué, **no** para saber qué existe hoy. El modelo vivo es [`core/schema/`](../../core/schema/) |
| [plan-cockpit-propio.md](./plan-cockpit-propio.md) | 577 | ✅ Construido. El cockpit está en producción con 17 pantallas sobre Postgres (ADR-025..028) |
| [plan-rescate-huerfanos.md](./plan-rescate-huerfanos.md) | 396 | ✅ Ejecutado: corrida `2026-08-31 04:30`, cerrada `ok` en 13 min |
| [evaluacion-proveedores-scraping.md](./evaluacion-proveedores-scraping.md) | 554 | ✅ Evaluación cerrada. Su veredicto es [ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md) y sus números viven en [costos.md](../costos.md). Acá queda el inventario largo: 5 actores de Apify y 7 alternativas externas con precio de primera mano, más el análisis de seguridad de Agent-Reach |
| [plan-costo-apify.md](./plan-costo-apify.md) | 350 | 🪦 Su tesis (*"el costo de Apify no es sostenible"*) quedó desmentida el 2026-09-12. Medido pieza por pieza, **16 de sus 19 hallazgos ya estaban en [costos.md](../costos.md)** y los otros 3 también con otras palabras; lo único sin dueño se mergeó allá. Sirve para leer el diagnóstico con su narrativa original y las predicciones commiteadas antes de disparar la corrida de control |
| [refactor-voces-proyectos.md](./refactor-voces-proyectos.md) | 467 | ✅ Terminado. Es el PRD original del refactor de julio y el porqué de ADR-023/024/025. Su pregunta central (§3 ⭐ Airtable vs dashboard propio) la cerró [ADR-025](../adr/ADR-025-cockpit-producto-propio.md) el 2026-07-17; sus 6 checkboxes abiertos están construidos o murieron con Airtable. El handoff lo llamaba "tablero activo" |

También está acá el [archivo del handoff](../agents/handoff-archivo-2026-06_09.md) *(vive en
`docs/agents/` para quedar al lado del vivo)*: cierres 70 a 144 y el log anterior al 2026-08-31.

**Lo que NO se archiva:** los [ADRs](../adr/). Un ADR viejo no es un ADR obsoleto, es historia que se
cita, y varios siguen gobernando código vivo.
