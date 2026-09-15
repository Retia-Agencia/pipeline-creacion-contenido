# ADR-100 — Se compra lo nuevo y se re-mide lo joven

> **Estado:** Aceptada · diseño y texto aprobados por Mani el 2026-09-15. Sin construir.
> **Toca `core/`**: migración `045` (vistas + clave de ajuste) y contrato
> [`run-plan.md`](../../core/contracts/run-plan.md) (cambio **aditivo**, `version` sigue en 2).
> Ejecuta el paso 5 de [plan-refactor-motor §7](../agents/plan-refactor-motor.md) (marca de agua) y
> le suma la re-medición dirigida que sale de §1.4.

## Contexto, medido

1. **Cada corrida re-compra casi todo lo que ya tenía.** A cada cuenta se le piden los 25 reels más
   nuevos de los últimos `Días de recencia` (hoy 50). Para una cuenta activa eso es la misma bolsa
   que la semana pasada: se re-compra ~86 % (costos §4.3.5), y el 10/09 el 74 % de la factura fue
   re-compra del mismo día.
2. **El pool ya guarda lo pagado** (`app.pool_crudo`, ADR-099) y `app.v_watermark_referentes` ya
   sabe el reel más nuevo comprado de cada cuenta. Nadie la lee.
3. **Las vistas de un reel joven mienten** (plan §1.4, 2.980 reels medidos dos veces): comprado a
   0-1 día crece +110 % mediano después, a 3-7 días +7-15 %, a más de 30 días +0,1 %. Un reel es
   joven hasta los 7-14 días.
4. **Lo joven y cerca del piso cruza.** De los reels de menos de 7 días con 100k-400k, cruzaron
   400k **14 de 75 (19 %)**; en la banda 200k-400k de 0-3 días, **7 de 13**.
5. **Re-medir un reel por URL funciona y cuesta 0,0023 USD** (`resultsType: posts`,
   `resultsLimit: 1`; run `JrdYsvf52nlFdhrNt`, `chargedEventCounts.result = 6`). El ítem vuelve con
   `type: "Video"`, `ownerUsername`, `timestamp` y `videoPlayCount`, o sea que `Normalizar IG` y
   `Preparar pool crudo` lo leen igual que uno de colecta.
6. **Medido contra prod el 15/09:** 59 referentes IG activos · 4 sin marca · mediana 8 días desde
   la marca · 1 con marca de más de 30 días · ritmo total ~434 reels/semana. Con esta ADR la
   próxima corrida compraría **~600 reels** (techo 30 días) contra **hasta 1.475** hoy
   (59 × 25). Candidatos a re-medir hoy: **74** (~0,17 USD, una sola vez).

**Por qué van juntas.** Solo marca de agua: se deja de re-comprar, pero lo joven nunca se vuelve a
medir y se pierden los que iban a cruzar. Solo re-medición: se atrapan esos, pero se sigue
re-comprando el 86 %. Salen en el mismo deploy y bajo el mismo interruptor.

## Decisión

### D1 · Desde cuándo se compra cada cuenta

```
desde(ref) = max( marca_de_agua(ref), hoy − Días de recencia )
cuenta sin marca  →  hoy − Días de recencia
```

`marca_de_agua` = `max(publicado_en)` de `v_watermark_referentes` (robusta a posts fijados por usar
`max`, ADR-099 §T1). Viaja como fecha ISO a `onlyPostsNewerThan`, que la acepta (input schema del
actor: *"YYYY-MM-DD, ISO format, or relative"*). `Días de recencia` deja de ser la ventana y pasa a
ser el **techo** de cuánto se mira hacia atrás. Recomendado: 30.

### D2 · Cuántos se le piden: el cupo tapa el hueco

Si una cuenta publicó 60 desde su marca y se le piden 25, llegan los 25 más nuevos, la marca salta
encima de los otros 35 y **esos no se compran nunca**. Entonces:

```
ritmo_semanal(ref) = reels distintos con publicado_en en los últimos 28 días ÷ 4
limite(ref)        = max( Resultados por cuenta de referente,
                          ceil( ritmo_semanal × días_desde(ref) ÷ 7 × 1,3 ) )
```

- El piso en `Resultados por cuenta` es inofensivo: Apify cobra lo que vuelve, no lo que se pide.
- El motor sigue aplicando `cap_resultados_referente` (500) con el aviso que ya existe. Si topa, el
  aviso nombra la cuenta: ahí sí quedó un hueco y se sabe dónde.
- `ritmo_semanal` sale de un pool que hasta hoy topaba en 25, así que subestima en cuentas
  prolíficas. El 1,3 y el piso lo absorben; el aviso de tope lo delata.

### D3 · Qué se re-mide

Un reel entra a la lista si **su última observación** en `pool_crudo`:

| condición | por qué |
|---|---|
| tenía **menos de 7 días** de publicado al medirse | §1.4: lo maduro casi no cambia |
| tenía vistas en **[25 % del piso, piso)** — hoy [100k, 400k) | La banda que cruza. Atada al piso para que siga sirviendo si se mueve (⚠️ medida solo con piso 400k) |
| se midió hace **al menos 1 día** | No re-medir en la misma tanda |
| está publicado dentro de **`Días de recencia`** | Si no, `Asignar proyecto+voz` lo tira por viejo después de pagarlo |
| **no está en `processed_items`** | Ya se entregó; volver a medirlo no cambia nada |
| es de un **referente IG activo del plan** | Si la cuenta se apagó, el reel no tiene a quién ir |

**Se termina solo:** re-medido, su nueva última observación ya no tiene menos de 7 días, y sale de la
lista. **Orden:** vistas descendente. **Tope: 200 por corrida**, con aviso si corta (provisional,
freno de seguridad; la primera vez serían **hasta 74**, antes de aplicar los filtros de recencia y
de referente activo).

🩸 **Lo que se acepta perder:** reels viejos que reviven (`askvinh`, 18k a los 34 días → 609k).
Ninguna regla barata los atrapa.

#### D3.1 · Rescate por cambio de piso (agregado en la revisión del 15/09)

**El hueco:** antes, un reel que pasaba el piso y no se entregaba volvía en la próxima corrida porque
se re-compraba (ADR-087). Con la marca de agua no vuelve. Medido el 15/09 (cuentas activas, 30 días):
**102** así. **53** ya habían pasado 500k en 2 o más días y el motor los botó cada vez (28 se
transcribieron el 08/09 y ninguno quedó de candidato): volver no los salva. **29** están entre 400k y
500k y nunca tuvieron su oportunidad, porque el piso bajó a 400k ese día. **20** pasaron 500k un solo
día.

**Decisión de Mani: rescate único.** También entra a `remedir`, **una sola vez**, un reel que:

| condición | por qué |
|---|---|
| hoy tiene vistas **≥ piso** | pasaría el piso actual |
| su última medición es **anterior a `actualizado_en` de `Mínimo de vistas`** | nunca se evaluó con este piso |
| cumple recencia, ≥ 1 día desde la medición, referente IG activo | lo mismo que D3 |

Se apaga solo: re-medido, su medición queda después del cambio. Sirve igual la próxima vez que se
mueva el piso, sin tocar código. La primera corrida rescata **102** (~0,23 USD). Separar los 53 ya
rechazados pedía guardar el piso anterior, y el ahorro eran 0,12 USD una sola vez.

⚠️ **Depende de que `actualizado_en` diga la verdad.** Un cambio de piso hecho por SQL no la mueve
mientras la [`043`](../../core/schema/043_ajustes_actualizado_en.sql) (ADR-097) no esté aplicada. En
ese caso no hay rescate, que es el lado seguro: no se paga de más. Por eso la `043` va antes en la
salida a producción, y `fields.actualizado_en` de `ajustes` viaja en el plan (aditivo).

### D4 · Quién calcula: la fachada `run-plan` (ADR-035)

La fachada calcula `desde`, `limite`, `ritmo_semanal` y la lista; el motor solo ejecuta. Forma
**aditiva** del plan de reels (`version` sigue en 2, igual que `pipeline` en ADR-068):

```json
{
  "referentes": [{ "id": "uuid…", "fields": { "handle": "@…", "…": "…",
                   "desde": "2026-09-07T14:02:11Z", "limite": 25, "ritmo_semanal": 6.5 } }],
  "remedir":    [{ "external_id": "3970801575865573889", "handle": "jen_gottlieb",
                   "url": "https://www.instagram.com/reel/<shortcode>/" }],
  "marca_de_agua": true
}
```

- Solo en `?ambito=motor`. En `completo` no viajan (archivado y descubrimiento no compran).
- `desde` es `null` si el interruptor está apagado. `remedir` es `[]` en ese caso, nunca ausente.
- La URL la arma la fachada desde `external_id` (media id → shortcode, base64 de Instagram), porque
  `pool_crudo` no guarda URL. Probado el 15/09 con 6 reels.

**Por qué no el motor leyendo `pool_crudo` directo:** el motor pasaría a leer config de dos lugares
(rompe ADR-035), la regla de D3 quedaría en un Code node sin `node:test`, y si ese GET falla no
queda claro si compra todo o nada.

### D5 · El motor: sin topología nueva

- **`Armar plan de corrida`** lee `desde`/`limite` por referente y `remedir`.
- **`Split IG referentes`** emite un ítem por cuenta con `{ urls: [perfil], tipo: "reels", desde,
  limite }` y, si `remedir` no está vacío, **un ítem más** con `{ urls: [...reels], tipo: "posts",
  limite: 1 }` y sin fecha. Una sola corrida de Apify para toda la re-medición.
- **`Apify — IG Reels`** generaliza su `customBody` a esa forma.
- **`Normalizar IG`, `Merge scrapes`, `Preparar pool crudo`, `Asignar proyecto+voz`** no cambian:
  lo re-medido entra por el mismo camino que lo colectado (pool → dedup → piso → transcripción →
  gate).
- **`Etapa: colecta`** registra en `runs.params`: `marca_de_agua`, reels pedidos y re-medidos.

Sin nodos ni conexiones nuevas ⇒ va por `n8n:push --nodos`, no por re-import.

### D6 · El interruptor y el fallo seguro

- Clave nueva de ajuste **`Usar marca de agua`** (toggle, default 1). Entra en los tres lados que
  exige el catálogo: check de `app.ajustes` (migración `045`), `CATALOGO` de `domain/ajustes.ts` y
  `AJUSTE_MAP` del motor.
- **Apagado, o si al referente le falta `desde`, el motor compra como hoy**
  (`onlyPostsNewerThan = Días de recencia`, `resultsLimit = Resultados por cuenta`) y lo avisa en
  `runs.metricas.avisos`. El peor caso es pagar lo de hoy, nunca dejar de traer.
- **Si la fachada no puede calcular la marca** (falla la lectura de las vistas), **no aborta**:
  sirve el plan con `desde: null` en todos y `remedir: []`, más `marca_de_agua: false` y un motivo.
  El motor cae al comportamiento de hoy y lo avisa. El fail-closed de ADR-028 sigue gobernando lo
  que sí rompe una corrida (voces, proyectos, referentes, ajustes); la marca de agua es un ahorro,
  y perder un ahorro no justifica no entregar.

### D7 · Migración `045`

- `app.v_ritmo_referentes`: por `(instance_id, plataforma, handle)`, `ritmo_semanal` sobre 28 días.
  Separada de `v_watermark_referentes` para no cambiar una vista que ADR-099 ya verificó.
- `app.v_remedir_candidatos`: última observación por reel con `edad_al_medir`, `vistas`,
  `publicado_en`, `medido_en`, excluyendo lo que está en `processed_items`. Los umbrales (piso,
  días) **no** viven en la vista: los aplica la fachada al leer, porque son ajustes que se mueven.
- Clave `Usar marca de agua` en el check de `app.ajustes` + su fila por instancia.

## Alternativas descartadas

- **Repaso de R días** (retroceder la marca para re-comprar lo joven): re-compra todo lo de la
  cuenta en esos días, sirva o no. La dirigida paga solo lo que puede cambiar la decisión.
- **Marca que avanza al más nuevo ACEPTADO** (tarea de Notion del 10/09): vuelve a comprar la
  cuenta entera para re-medir lo joven, y depende de un veredicto aguas abajo.
- **Motor leyendo `pool_crudo` por PostgREST:** ver D4.
- **API oficial de Meta (`view_count` por Business Discovery):** gratis pero cubre 25-50 % del roster
  y pide un token que no existe. Queda como segundo carril a futuro.
- **Re-medir todo el pool reciente:** paga por maduros que no cambian (§1.4).
- **Cambiar a `instagram-reel-scraper` por `skipPinnedPosts`:** fuera de alcance (ver riesgos).

## Consecuencias y riesgos

- **Los posts fijados** se siguen colando aunque haya fecha. Con la marca de agua pasan de ~6 % a
  ~31 % de lo que se compra (plan §5.3 T7). Se filtran después de pagar. Decisión de actor aparte.
- **La marca depende de que el motor escriba `pool_crudo`.** Al 15/09 tiene 0 filas del motor; la
  marca sale del backfill del 14/09. Si `POST pool crudo` falla en silencio, la marca se congela y
  se re-compra como hoy: se paga de más, no se pierde nada. La primera corrida verifica las dos.
- **`Días de recencia` cambia de significado** (ventana → techo). La descripción del ajuste en la
  pantalla tiene que decirlo.
- **Habilita** la pestaña de Referentes nueva (ritmo, costo, embudo, historia) y el aviso antes de
  ▶ ("última compra hace X días · ~N reels · ~$Y"). **No se construyen acá:** van en su propia ADR
  con su mockup.

## Verificación

1. `domain/`: `node:test` para `desde`, `limite`, la regla de D3 (cada fila de la tabla con su caso
   de borde) y el media id → shortcode.
2. `test-nodos.mjs`: `Split IG referentes` con y sin `remedir`, con el interruptor apagado, y con un
   referente sin `desde`.
3. `migración 045` verificada por efecto: una cuenta sin pool aparece en el plan con `desde` de
   techo; un reel entregado no aparece en `remedir`.
4. `n8n:push` + `n8n:diff` verde.
5. **Una corrida real, confirmada por Mani antes (cuesta).** Se mira: reels comprados contra ~600
   esperados · re-medidos contra la lista · `pool_crudo` con filas `origen = motor` · cuántos
   re-medidos cruzaron el piso · factura por `chargedEventCounts`, no por `usageTotalUsd`.
