# ADR-104 — La etiqueta de rendimiento decide qué se muestra, y el piso de vistas deja de filtrar

> **Estado:** **Aceptada** (Mani, 2026-10-18), **salvo D3: rechazada por Mani el 2026-10-20** (§Enmienda 2: el piso de 400k filtra y la etiqueta informa y ordena; C9 retirado). ⚠️ **D3 toca el piso de 500.000, que es instrucción
> del jefe** ([plan-refactor-motor §0](../agents/plan-refactor-motor.md)): se presenta en la reunión
> del martes 21/10 para su visto bueno antes de construir C9. D1, D2, D4 y D5 no dependen de eso.
> **Enmienda** [ADR-103](./ADR-103-apify-vigila-el-roster-virlo-busca-y-la-edad-no-descarta.md) D5
> (fija los cortes, y la etiqueta pasa de "no filtra" a "decide qué muestra el Feed", sin descartar) y
> el uso de `Mínimo de vistas` como filtro de entrada ([ADR-011](./ADR-011-tabla-ajustes-knobs-no-code.md)).
> Evidencia: [plan-refactor-motor §1.5](../agents/plan-refactor-motor.md), medido el 18/10 en
> `app.pool_crudo`. Consulta: [`docs/experimentos/2026-10-18-etiqueta-rendimiento.sql`](../experimentos/2026-10-18-etiqueta-rendimiento.sql).

## Contexto

ADR-103 D5 dejó la dirección (una etiqueta por vistas por día de vida, sin filtrar) y los cortes
abiertos hasta medirlos. Medido el 18/10 sobre 34.906 observaciones de Instagram (§1.5):

1. **Vistas por día de vida no es neutral a la edad.** La mediana cae ~4× por franja: 6.853/d con
   menos de 7 días, 3.553 con 7–14, 1.427 con 14–50 y 246 con más de 50. Un reel junta casi todo al
   principio y el denominador sigue creciendo.
2. **El piso de 500k y la compra de lo nuevo chocan** (ADR-103 §Contexto 3): de 1.904 reels nuevos
   que compró el motor del 16/09 al 15/10, **240** pasaban el piso; **1.105** son *muy bueno* o
   *bueno* con la vara de abajo.
3. **Los jóvenes de 100k–400k (< 7 días) son casi todos *muy bueno*** (257 de 274). Los que además
   están en el top 10 % de su edad cruzaron 500k más seguido (11 % contra 3 %, 10 cruces en 205
   re-medidos: señal, no prueba).
4. **Solo hay Instagram en `pool_crudo`**: cero filas de TikTok, y el equipo solo usa Instagram hoy.

## Decisión

- **D1 — Vara única.** La etiqueta usa los mismos cortes para todas las edades, sobre
  `vpd = vistas / max(días de vida, 1)`:

  | etiqueta | vpd |
  |---|---|
  | **muy bueno** | ≥ 20.000 |
  | **bueno** | ≥ 5.000 |
  | **medio** | ≥ 1.000 |
  | **bajo** | < 1.000 |

  Son el p90 · p75 · p50 de los reels sin fijados al 18/10 (20.484 · 5.257 · 963), redondeados. Se
  re-miden con la misma consulta cuando entre Virlo o cambie el roster; no se mueven a ojo.
- **D2 — "Contra su edad" es un insight al lado, no la etiqueta.** El lugar del reel entre los de su
  misma franja de edad (*top 10 % · top 25 % · top 50 % · mitad de abajo de su edad*), con los
  cortes por franja de §1.5. Sirve para separar jóvenes entre sí y para ver a un viejo que revive.
  No decide nada.
- **D3 — Pasan todos; el Feed muestra solo *muy bueno* y *bueno*.** El piso de vistas deja de ser
  filtro de entrada: todo video nuevo pasa al gate (transcripción + Claude), como cualquier otro.
  Los aprobados *muy bueno* y *bueno* se muestran en el Feed; los *medio* y *bajo* quedan como
  **backlog**: candidatos guardados y juzgados que el Feed no muestra, para rescatarlos si hacen
  falta. **La etiqueta no descarta**: ordena qué se ve primero y qué queda guardado.
  El corte se hace **después** del gate (Mani, 18/10), a sabiendas de que cuesta más que cortar antes.
- **D4 — Los nombres son *muy bueno · bueno · medio · bajo*** (los de ADR-103 D5).
- **D5 — Solo Instagram.** TikTok queda fuera de este ADR: no hay datos ni uso. Cuando TikTok entre
  se mide su propia distribución; no hereda estos cortes.

## Consecuencias

- (+) Los jóvenes que el piso dejaba afuera llegan al gate y, si rinden, al Feed.
- (+) Nada se descarta por vistas: el backlog conserva lo juzgado.
- (+) La etiqueta sale de un dato medido y re-medible, no de un número fijo de vistas.
- (−) **Más costo de gate y transcripción**: con los números del 16/09–15/10 pasan ~8× más videos al
  gate (1.904 contra 240). Apify no cambia (se paga antes de todo filtro: invariante de [costos.md](../costos.md)).
  Supadata en `auto` cuesta ~0,0016 USD por video; Claude cobra por lote. El tope `Videos a
  transcribir por corrida` sigue mandando. Se re-mide en C6.
- (−) La vara única favorece a los jóvenes: el 27 % de los de < 7 días sale *muy bueno* y el 71 % de
  los de > 50 días sale *bajo*. Por eso existe D2.
- (−) Dos definiciones de accuracy siguen en juego (vistas absolutas contra `aprobados / N` de
  ADR-089): esta decisión cambia la del jefe y por eso va a la reunión.
- **Abierto para construir (C3 y C9):** si el N pedido de ADR-089 cuenta solo lo que el Feed muestra
  o también el backlog; dónde ve el equipo el backlog; y si `Mínimo de vistas` se apaga con el ajuste
  en 0 o se borra.

## Enmienda 1 (2026-10-19) — Las etiquetas se configuran desde Ajustes, y se derivan al leer

> Decidido por Mani al construir C3. **Enmienda D1 y D4**: los cortes y los nombres de la tabla de D1
> pasan a ser **la semilla**, no el código.

- **E1 — Configurables por empresa.** Las etiquetas viven en `app.etiquetas_rendimiento` (migración
  [`048`](../../core/schema/048_etiquetas_rendimiento.sql)), una fila por etiqueta: nombre + mínimo.
  Media (no solo dev) las crea, renombra, cambia de mínimo y borra en **Ajustes → Rendimiento**; cada
  cambio queda en `app.eventos` con quién lo hizo. La semilla son las cuatro de D1.
- **E2 — Un rango se define por su piso.** El techo de una etiqueta es el piso de la siguiente, así
  que no puede haber huecos ni solapes. Debajo del piso más bajo, el video queda sin etiqueta.
- **E3 — La métrica hoy es una sola: vistas por día de vida** (`metrica = 'vpd'`). La columna existe
  para poder sumar otra métrica sin rehacer la tabla; la pantalla lo dice. Sumar una es ampliar el
  check y el dominio, y decidir qué pasa si dos etiquetas usan métricas distintas.
- **E4 — Se guarda el dato, no el veredicto.** `app.candidatos.publicado_en` (con `creado_en` da los
  días de vida). La etiqueta se calcula **al leer** (`domain/rendimiento.ts`), igual que la cobertura
  de la `039`: editar una etiqueta cambia el Feed al momento, sin backfill y sin mezclar dos varas.
- **E5 — El insight "contra su edad" (D2) sigue fijo en el código**, con los cortes de §1.5. Es
  informativo, no decide nada, y sus cortes salen de percentiles medidos. Se re-mide con la misma
  consulta.
- **E6 — Consecuencia para C9:** como las etiquetas se pueden renombrar, crear y borrar, D3 no puede
  decir "*muy bueno* y *bueno*" por nombre. Qué etiquetas ve el Feed tiene que ser una propiedad de
  cada etiqueta (un "se muestra en el Feed" editable en la misma pantalla), y se construye en C9.

## Enmienda 2 (2026-10-20) — El piso de 400k filtra; la etiqueta informa

**Mani, 20/10:** media necesita viralidad, y la viralidad son **vistas absolutas**. **El piso es 400k
y filtra.** Ya se habló varias veces y no se re-litiga.

- **D3 queda rechazada.** El piso no se apaga y no hay backlog de *medio*/*bajo*. C9 se retira.
- **La etiqueta (D1, D2, Enmienda 1) se queda**, en producción: informa en el Feed y ordena, no
  decide qué entra.
- **El problema real pasa a ser otro:** con el piso, pasan 2 videos por corrida (mediana de 13
  corridas), y el roster da ~49 reels/semana que llegan a 400k al madurar. Se resuelve trayendo más
  reels que crucen el piso, no bajándolo: **seguir revisando el pool** a la edad en que los reels
  cruzan (C10 en [07](../virlo/07-refactor-tickets.md), enmienda de ADR-100 D3).

