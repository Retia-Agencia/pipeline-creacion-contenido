# Archivo de docs

Planes **ya ejecutados** y documentos de sistemas **que ya no existen**. Se movieron acá el
**2026-09-12** para que `docs/agents/` contenga solo lo vivo.

**No se borraron, y la razón importa:** git conserva el contenido igual, pero borrar pierde la
capacidad de *encontrarlo* cuando alguien pregunte "¿por qué esta pantalla ordena así?". Mover
cuesta lo mismo y no tiene downside.

| archivo | líneas | por qué está acá |
|---|---|---|
| [plan-orden-y-filtro.md](./plan-orden-y-filtro.md) | 1.305 | ✅ Ejecutado y live el 2026-08-26, las 7 tareas cerradas y desplegadas. Lo que sigue vigente son sus decisiones, y esas viven en [ADR-076](../adr/ADR-076-ordenar-es-una-vista-no-una-consulta.md) |
| [mapa-campos.md](./mapa-campos.md) | 637 | 🪦 Mapea la base de **Airtable**, purgada el 2026-08-03. Sirve para saber qué campo servía para qué y por qué, **no** para saber qué existe hoy. El modelo vivo es [`core/schema/`](../../core/schema/) |
| [plan-cockpit-propio.md](./plan-cockpit-propio.md) | 577 | ✅ Construido. El cockpit está en producción con 17 pantallas sobre Postgres (ADR-025..028) |
| [plan-rescate-huerfanos.md](./plan-rescate-huerfanos.md) | 396 | ✅ Ejecutado: corrida `2026-08-31 04:30`, cerrada `ok` en 13 min |

También está acá el [archivo del handoff](../agents/handoff-archivo-2026-06_09.md) *(vive en
`docs/agents/` para quedar al lado del vivo)*: cierres 70 a 144 y el log anterior al 2026-08-31.

**Lo que NO se archiva:** los [ADRs](../adr/). Un ADR viejo no es un ADR obsoleto, es historia que se
cita, y varios siguen gobernando código vivo.
