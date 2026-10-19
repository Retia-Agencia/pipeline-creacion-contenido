# ADR-103 — Apify vigila el roster, Virlo busca por tema, y la edad etiqueta en vez de descartar

> **Estado:** **Aceptada** (Mani, 2026-10-17). D5 (los cortes de la etiqueta) y D7 (el aviso de corrida
> repetida) quedan con la dirección decidida y el detalle abierto: se cierran en sus tickets.
> **Enmienda** [ADR-102](./ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md) D3 (no hay corte: Apify
> deja de ser sombra y rollback y pasa a ser un carril), [ADR-016](./ADR-016-knobs-de-ejecucion-globales-y-tope-de-costo.md)
> (`dias_recencia` deja de descartar; queda solo como ventana de compra) y
> [ADR-010](./ADR-010-scoring-semantico-y-etapa-calidad.md) §4 (el gate fail-open no aplica cuando
> Claude no juzgó **ningún** video de la corrida).
> Evidencia: el reporte de las corridas del 09 al 15/10 (abajo, §Contexto), medido sobre las
> ejecuciones 206 a 217 de n8n.

## Contexto

Medido el 17/10 sobre las 6 corridas del motor del 09 al 15/10 (voz Juan Pablo Vieira, N = 70):

1. **La API de Claude estaba sin créditos** (`400 · credit balance is too low`). El pre-trim, la
   traducción y el gate fallaron en silencio y, por el fail-open de ADR-010, **los 30 videos que
   llegaron al gate salieron con `relevancia_score = null` y se entregaron 17 sin juzgar ni traducir**.
   Las corridas cerraron en verde.
2. **La guardia de recencia (capa 2, `Asignar proyecto+voz`) tiró los mejores videos del roster.**
   De 159 observaciones con 400k o más, 138 tenían más de 50 días y se descartaron. Son **45 videos
   distintos, todos reels fijados** (`isPinned`), re-comprados en cada corrida: el perfil de cada
   referente los devuelve aunque la compra pida solo lo nuevo. 40 de los 45 el equipo nunca los vio,
   y van hasta 13,7 M de vistas. Mani: *"si el video tiene más de 400k NUNCA se debería descartar"*.
   **La guardia solo cortaba fijados**: de todo lo que llegó con más de 50 días, el 100 % era fijado,
   porque el filtro de compra de Apify (`onlyPostsNewerThan`) frena todo lo demás y no puede frenar los
   fijados (lo dice su doc). Los fijados son el 21 % del gasto de Apify de esas corridas (ticket C8).
3. **Comprar solo lo nuevo (ADR-100) y exigirle 400k chocan**: lo comprado tiene una edad mediana
   de 4 a 15 días, y un reel de una semana casi nunca tiene 400k. 90 jóvenes iban entre 100k y 400k.
4. **Repetir la corrida el mismo día no trae nada** (3 de 4 el 15/10, "sin novedades") y cuesta igual.
5. **Virlo no reemplaza al roster**: encontró 3 de los 78 referentes en la sonda (A2), o sea que
   busca otra cosa. Y el roster de Vieira no tiene una sola cuenta de TikTok, que es donde Virlo rinde.

## Decisión

- **D1 — Dos carriles con trabajos distintos.**
  - **Apify vigila el roster**: cuentas que ya sabemos que publican bien, por handle, comprando solo
    lo nuevo de cada una (marca de agua, ADR-100). Barato y predecible.
  - **Virlo busca por tema**: agentes por temática (ADR-102 D1), en cualquier cuenta y plataforma.
  - **No hay corte** (V-12 de [07](../virlo/07-refactor-tickets.md) se retira): Apify no es sombra ni
    rollback, es un carril que se queda.
- **D2 — Una sola puerta.** Los dos carriles escriben al mismo Feed con el mismo dedup
  (`external_id` + `processed_items`). Cuando exista el asignador de Claude (A3) lo usan los dos; hasta
  entonces el motor de Apify sigue con su gate.
- **D3 — Virlo alimenta el roster.** Una cuenta que Virlo trae con videos aprobados se propone como
  referente (`app.referentes_propuestos`, que ya existe). El umbral (cuántos aprobados) sale de medirlo
  en el piloto, no se fija acá.
- **D4 — La edad no descarta.** Se borra la guardia de recencia de `Asignar proyecto+voz`. Un video que
  pasa el piso de vistas llega al gate y a un proyecto activo tenga la edad que tenga. `dias_recencia`
  queda **solo** como ventana de compra a Apify (`onlyPostsNewerThan` cuando una cuenta no tiene marca
  de agua), que es control de costo y no un filtro de calidad. En Virlo, la recencia de D-12 tampoco
  descarta: pasa a ser la ventana de lectura del agente.
- **D5 — La edad etiqueta: rendimiento por días de vida.** Cada video lleva una etiqueta de
  rendimiento que relaciona sus vistas con los días que lleva publicado (la medida base es vistas por
  día de vida). Se muestra en el Feed como una etiqueta (ej. *muy bueno · bueno · medio · bajo*) y **no
  filtra**. 📏 **Los cortes no se inventan**: salen de la distribución medida en `app.pool_crudo`
  (32 mil observaciones, 3.723 reels medidos en 2+ fechas). Queda abierto si la etiqueta además deja
  entrar a un reel joven bajo el piso (ej. 7 días con 200k): eso toca el piso, que es instrucción del
  jefe, y se decide con él.
- **D6 — Si Claude no juzgó ningún video, no se entrega nada.** Cuando todas las llamadas del gate
  fallan en una corrida, los videos se retienen (no van al Feed ni a `processed_items`, así la próxima
  corrida los vuelve a evaluar), el run cierra en `fallo` y el aviso nombra la causa (*sin créditos*
  cuando el error lo dice). El fallo parcial de un lote sigue fail-open como dice ADR-010.
- **D7 — Una corrida de Apify por voz y por día.** El cockpit avisa antes de correr una voz que ya
  corrió hoy: no va a traer nada nuevo y cuesta igual. Dirección decidida; si es aviso o bloqueo se
  define en su ticket.

## Consecuencias

- (+) Los mejores videos del roster dejan de botarse: los 45 fijados entran una vez y el dedup los
  frena después.
- (+) Cada proveedor hace lo que mejor hace, y el roster crece con lo que encuentra Virlo.
- (+) Un fallo total de Claude ya no llena el Feed de videos sin juzgar.
- (−) Más videos llegan al gate: más transcripciones y más llamadas a Claude la primera vez que entran
  los fijados (45 hoy, una sola vez).
- (−) Dos carriles para mantener en vez de uno. n8n no se apaga mientras el carril de Apify viva ahí.
- (−) **El costo por voz no se puede calcular hoy**: cambian la compra, el gate y el proveedor. Se
  re-mide en [costos.md](../costos.md) después del refactor (ticket C6 de [07](../virlo/07-refactor-tickets.md)).

## Enmienda 1 — es_fijado en pool_crudo (2026-10-18)

Los fijados son el 21 % del gasto (ticket C8), y sin conservar la marca no se puede medir si ocupan
cupo de `resultsLimit`. La migración `047_pool_crudo_es_fijado.sql` agrega `es_fijado` sin backfill:
`true` si Apify marcó `isPinned`, `false` si vino y no está fijado, y `null` si no se sabe (filas
anteriores o actor sin el campo). `resultsLimit` no cambia hasta medir esta evidencia.
