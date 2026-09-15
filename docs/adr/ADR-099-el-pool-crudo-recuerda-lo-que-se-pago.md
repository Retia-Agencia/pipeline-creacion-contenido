# ADR-099 — El pool crudo recuerda lo que se PAGÓ, no lo que se entregó

> **Estado:** Aceptada · **toca `core/`** (migración [`044`](../../core/schema/044_pool_crudo.sql),
> script [`backfill-pool-crudo.mjs`](../../core/scripts/backfill-pool-crudo.mjs)).
> Escrita el 2026-09-15. Ejecuta los pasos 2 y 3 de
> [plan-refactor-motor §7](../agents/plan-refactor-motor.md#7--orden-de-ataque-propuesto).

## Contexto — lo que falta, medido

`public.processed_items` guarda lo que se **entregó** (ADR-087): 1.952 filas, 866 videos que llegaron
al Feed. `app.descartes` guarda solo la banda borderline del gate. `app.videos_meta` guarda lo que se
compró **a pedido** desde el cockpit. **Ninguna tabla guarda lo que la corrida del motor le compró a
Apify y después tiró en `min_views`** — y eso es el 71,8 % de lo pagado (ADR-087) y el 74-98 % de la
factura de un día (costos §4.3.5).

Sin ese registro no hay:

1. **marca de agua por referente** (plan §3.4) — no se sabe cuál fue el reel más nuevo ya comprado
2. **la mitad de arriba del ledger de cuentas** (plan §3.3) — el ledger ve 3-6 de ~59 cuentas
3. **`ritmo_publicacion`** para dimensionar `resultsLimit`
4. **base de la cuenta** para el cociente de `viralidad` (plan §3.2)
5. **la cohorte longitudinal** que probó que las vistas no se congelan (plan §1.3)

🔴 **Y hay un plazo duro:** Apify (plan STARTER) borra sus datasets a los 31 días. Los datasets
pagados del 2026-09-10 desaparecen el **2026-10-11**; hoy son legibles ~407 runs desde el ~2026-08-17
(~11.400 reels únicos, verificado). **Copiarlos es el único paso irreversible del plan** (§7 paso 3):
lo que no se copie antes del 11/10 se pierde para siempre. Leer datasets propios es **gratis** (§8.5).

Este ADR resuelve las tres preguntas de dev que el pool necesita: **T1** (grano de la marca de agua),
**T2** (tabla nueva vs columna), **T3** (dónde vive `base_cuenta`).

## Decisión

### T2 — Una tabla NUEVA, `app.pool_crudo`, no una columna en `processed_items`

**Grano distinto.** `processed_items` tiene **una fila por video entregado** (lista negra del dedup,
clave `(instance_id, platform, external_id)`). El pool tiene **una fila por OBSERVACIÓN de un reel**:
el mismo reel medido el 17/08, el 24/08 y el 07/09 son **tres filas**, porque esa historia
longitudinal es exactamente lo que probó que las vistas nunca se congelan (plan §1.3). Meter esto
como columna `entregado` en `processed_items` mezclaría dos granos incompatibles y rompería el dedup,
cuya unicidad es por video, no por observación.

- **PK = grano = idempotencia, en una sola llave:** `(instance_id, plataforma, external_id,
  apify_dataset_id)`. Una observación es un reel dentro de un dataset: el mismo reel medido otro día
  vive en otro dataset (se conserva la historia) y re-correr el backfill **no duplica**.
  🩸 *La primera versión tenía la PK por `medido_en` y un unique aparte por dataset.* Revisado antes
  de aplicar: el motor abre ~24 corridas de Apify en paralelo, dos pueden compartir `startedAt`, y un
  upsert que resuelve contra el dataset chocaba contra la PK — el backfill se caía a mitad de camino
  mientras los datasets se vencen. Dos llaves para un mismo hecho es un bug esperando su fecha.
- **Qué corridas se copian:** todas las del actor de reels con dataset, **sin filtrar por
  `meta.origin` ni por `status`**. Una sesión de agente o una corrida con timeout también compraron
  reels reales; copiarlos es gratis y saltearlos es irreversible. Lo que no es reel lo descarta el
  normalizador por item.
- **Scoping:** `instance_id → instances`, grano **instancia**, igual que `app.candidatos`,
  `app.descartes` y `app.videos_meta` (ADR-046: el motor escribe por instancia; un pool crudo es un
  subproducto de una corrida, que tiene `instance_id`). **No** `client_id`: el reel crudo lo compró
  una corrida de una instancia, no una empresa en abstracto. La asignación a proyectos ocurre
  aguas abajo (ADR-013/032) y no pertenece al pool.

### T1 — La marca de agua es por REFERENTE (handle), y es DERIVADA

Apify compra **por cuenta** (`directUrls` de un perfil), no por proyecto. La asignación
referente→proyecto es n-a-n y pasa aguas abajo (ADR-032). Guardar la marca de agua por
`(referente, proyecto)` inventaría un grano que la compra no tiene: si un handle alimenta 4 proyectos,
tendría 4 marcas de agua para un solo cursor de Apify que es uno solo. **Por handle, y punto.**

**Derivada, no guardada:** la marca de agua es `max(publicado_en)` sobre las filas del pool de ese
handle. Guardar una columna `watermark` sería un segundo dueño del mismo hecho (ADR-027) que se
atrasa la primera vez que alguien inserta una fila sin actualizarla. Se materializa como **vista**
`app.v_watermark_referentes`, no como columna.

🩸 **La trampa de los posts fijados** (costos §4.3.5): los posts *pinned* de Instagram se saltean el
filtro de fecha y vuelven con timestamps viejísimos (hasta 989 días), en las posiciones 1-8 del
dataset, nunca más de 3 por cuenta. Un `max(publicado_en)` ingenuo estaría bien (un pin es *viejo*, no
*nuevo*, así que no infla el máximo) — **pero un `min`/ventana sí se envenena**. La vista de watermark
usa `max` y por eso es robusta a pins por construcción; se documenta el trap en la migración para que
nadie invierta el sentido. El `avance(edad)` y cualquier cálculo de ventana que se construya después
(plan §3.1, fuera de alcance acá) **deben** excluir las filas cuyo `publicado_en` sea más viejo que la
ventana de la corrida. Eso queda anotado y no implementado (no hay `avance()` todavía).

### T3 — `base_cuenta` se recalcula al leer, no se materializa (por ahora)

`base_cuenta` (mediana de `vistas_normalizadas` de los ~30 reels recientes de la cuenta, plan §3.2)
depende de `avance(edad)`, que **todavía no existe** (M1-bis, plan §5.2, fuera de alcance). Con ~23k
filas/año una mediana por handle es una consulta barata. Materializarla ahora sería cachear una
fórmula cuyos insumos aún no están decididos — YAGNI, y el mismo error que ya cometió `heat_score`
(ADR-092, D5). Se recalcula al leer hasta que un número diga que hace falta.

### Columnas

`instance_id · plataforma · external_id · handle` (normalizado, sin `@`, minúsculas) ·
`publicado_en · vistas · likes · comentarios · seguidores`(nullable)· `duracion_seg`(nullable)·
`medido_en` (cuando Apify lo devolvió) · `apify_run_id · apify_dataset_id` ·
`run_id`(nullable FK a `runs`, nuestra corrida cuando se conoce)· `origen`
(`'motor' | 'backfill' | 'manual'`) · `traido_en`.

**`handle` normalizado y `external_id`** son la identidad estable; el handle se guarda además del
`instance_id` porque el ledger y la marca de agua se agrupan por cuenta, y un handle sobrevive a que
el referente se borre (misma decisión que ADR-045: la historia se guarda por handle en texto).

## Alternativas descartadas

- **Columna `entregado` en `processed_items`** (T2): grano incompatible (una fila por video vs una por
  observación), rompería el dedup.
- **Marca de agua por `(referente, proyecto)`** (T1): inventa un grano que la compra de Apify no
  tiene; 4 marcas para un cursor.
- **Guardar la marca de agua en columna** (T1): segundo dueño del mismo hecho, se atrasa solo.
- **Materializar `base_cuenta`** (T3): cachea una fórmula cuyos insumos (`avance()`) no existen.
- **Ponerle expiración al pool** (plan §6): ~23k filas/año, YAGNI.
- **Scoping por `client_id`**: el reel crudo es de una corrida, que es de una instancia.

## Consecuencias

- Habilita la marca de agua, el ledger de arriba, el ritmo de publicación y la base de cuenta — pero
  **ninguno se construye acá**: esta decisión es solo la tabla, su vista de watermark, el backfill y su
  test. El motor no se toca (fuera de alcance).
- El backfill es **re-corrible sin duplicar** (la PK). Su default es dry-run; `--apply` escribe.
- 🔴 **Fecha de vencimiento, y no es una sola:** Apify borra un día de datasets por día. Los más
  viejos (17/08) vencen el **2026-09-17**; los del 10/09, el 2026-10-11. *El plan decía "antes del
  11/10" y eso era la fecha del último día, no del primero.* Es el único paso irreversible, y además
  el script **grita** si algún dataset no se pudo leer, en vez de contarlo como vacío.

## Verificación

✅ **Aplicada por Mani el 2026-09-15 y verificada por efecto:** 16 columnas · PK
`(instance_id, plataforma, external_id, apify_dataset_id)` · 3 índices · policy `tenant` (ALL) ·
PostgREST 200 · el check de `origen` rechaza `'cualquiera'` con **23514**.
✅ **Backfill con `--apply` el mismo día:** 392 corridas del actor, **0 datasets sin leer**,
**32.243 observaciones** (= lo que el dry-run dijo que escribiría), **10.940 reels**, **334
cuentas** (= 334 filas en `v_watermark_referentes`), 367 datasets entre el 17/08 y el 14/09, y
**3.723 reels medidos en 2 o más fechas** — la cohorte longitudinal. 56 filas sin `vistas` (null, no
cero), 0 sin `publicado_en`.
🩸 **Costo real de la copia: +0,0136 USD** en el saldo de Apify (27,7548 → 27,7684). Leer datasets
no es gratis: es ~1,4 centavos por 32 mil items.

La guía original, para re-verificar:

Por efecto, después de aplicar la `044` a mano (ver la migración): la tabla existe con 16 columnas, la
policy `tenant` quedó, PostgREST la devuelve con `[]` (no 404), y `select count(*) from app.pool_crudo`
nace en **0** (el backfill la llena, no la migración). El canario de si sirvió es que ese count suba
tras el `--apply`, y que `app.v_watermark_referentes` devuelva una fila por handle con su
`max(publicado_en)`.
