# El sistema visual del cockpit

> **Leé esto antes de tocar una pantalla.** Es el dueño de cómo se ve el cockpit: los colores, los
> tamaños, los componentes y las reglas. Si una pantalla nueva no se parece a las demás, la culpa
> es de no haber leído esto, no del gusto de quien la escribió.
>
> Para **cambiar** la paleta (no para usarla) está [brief-visual.md](brief-visual.md): se llena,
> se traduce a `globals.css`, y las 12 pantallas cambian solas.

**Para quién es el cockpit:** Majo y Jero, el equipo de redes. No tocan n8n ni Supabase, viven el
95% del tiempo en *Curar → Feed*, y muchas veces entran desde el celular. Todas las reglas de acá
salen de eso. Cuando dudes, la pregunta es *"¿esto le dice a Majo qué hacer?"*, no *"¿esto se ve
moderno?"*.

---

## 1. La regla de oro

**Ningún color se escribe en un `.tsx`.** Todos salen de los tokens de
[`apps/dashboard/app/globals.css`](../../apps/dashboard/app/globals.css).

```tsx
// ❌ NO
<p className="text-amber-700 dark:text-amber-500">

// ✅ SÍ
<p className="text-atencion-fuerte">
```

Esto no es purismo: los `text-amber-*` sueltos que había eran invisibles para cualquier cambio de
paleta, y cada uno traía su propio `dark:` a mano. Con el token, cambiar el ámbar de todo el
cockpit es una línea.

Lo mismo con el lenguaje: **las palabras que traducen un concepto viven en `domain/`**
(`ESTADO_LEGIBLE`, `RAZON_FALTANTE_LEGIBLE`, `ETIQUETA_HEAT`), no sueltas en el JSX. Hay dos
pipelines con pantallas gemelas; una frase escrita en el `.tsx` ya son dos frases.

---

## 2. Los colores

### Los de siempre (shadcn)

`background` · `foreground` · `card` · `popover` · `primary` · `secondary` · `muted` · `accent` ·
`border` · `input` · `ring`.

Dos cosas que no son el default y conviene saber:

- **El fondo no es blanco puro**, es apenas cálido (`oklch(0.994 0.003 85)`), y **la card sí es
  blanca**. Ese medio punto de diferencia es lo que hace que las tarjetas floten sin sombras
  pesadas ni bordes duros. No "arregles" el fondo poniéndolo blanco.
- **Los neutros llevan una pizca de croma cálido**, no croma 0. Es la diferencia entre gris de
  sistema y gris de algo hecho por alguien.

### Los cuatro estados (+ destacado)

Cada uno viene en **tres piezas, y las tres hacen falta**:

| Token | Para qué |
|---|---|
| `--exito` / `bg-exito` | el sólido: puntos, íconos, bordes, barras |
| `--exito-suave` / `bg-exito-suave` | el fondo de un badge o de un aviso |
| `--exito-fuerte` / `text-exito-fuerte` | el texto **sobre** ese fondo suave (contraste AA) |

| Estado | Significa | Dónde se usa hoy |
|---|---|---|
| **`exito`** | Bien / terminado | corrida `ok`, aprobado, transcripción lista |
| **`en-curso`** | Esperando / trabajando | corrida `en_curso`, cola del transcriptor |
| **`atencion`** | Ojo, a medias | corrida `parcial`, *"no le alcanza ni en el mejor caso"*, `0/62 auditados` |
| **`destructive`** | Mal / falló / borrar | corrida `fallo`, errores |
| **`destacado`** | Lo ejemplar | el 🔥 del feed, "Caliente" |

**Dos reglas de uso que ya se pagaron:**

1. **Un cero no siempre es bueno.** `0 falsos negativos` con `0 auditados` no es éxito, es ausencia:
   ahí el tono va `neutro` o `atencion`, nunca verde. Mirá `Metrica` en `entender/secciones.tsx`.
2. **El color refuerza la palabra, no la reemplaza.** Quien no distingue colores tiene que poder
   leer lo mismo en el texto. Por eso "Flojo"/"Frío" es gris y no rojo: no es un error, es el
   último del orden.

### Los emoji del feed no se tocan

🔥 👍 👎 son el vocabulario del equipo, están en el manual y en el dominio (`CALIFICACIONES`).
No se reemplazan por íconos. El primario se eligió para no competir con ellos.

---

## 3. Tipografía y forma

- **Fuente:** Geist (sans y mono), ya cargada en el root layout.
- **`text-sm` es 15px y `text-xs` es 13px**, no los 14/12 del default. Se redefinen en el
  `@theme` de `globals.css`, así que **subir la legibilidad de todo el cockpit es una línea ahí**,
  no una pasada por 55 archivos.
- **Radio base `0.625rem`** (10px), con la escala derivada (`rounded-lg`, `rounded-xl`…).
- **Ancho del contenido: `max-w-7xl`** (1280px). El feed entra en 5 columnas.
- **`tabular-nums` en todo número que se actualiza solo.** Sin él, una métrica que cambia de
  dígito cambia de ancho y la fila salta (Operar refresca sola mientras hay una corrida viva).

---

## 4. Los componentes

Antes de escribir un `div` con clases, fijate si ya existe. Todos en `components/ui/`.

| Componente | Cuándo | Regla |
|---|---|---|
| **`Encabezado`** | El título de toda pantalla | `titulo` + bajada + `icono` + `accion` opcional. La **acción principal va acá**, no enterrada en la primera card. |
| **`EstadoVacio`** | Cuando una lista está vacía | **Si hay una próxima acción razonable, va en `accion`.** Es el momento exacto en que alguien no sabe qué hacer. La excepción es "ya terminaste": ahí el vacío es buena noticia y no lleva pedido. |
| **`Metrica`** | Un número que se lee de un vistazo | **Etiqueta arriba, número abajo.** Al revés obliga a leer hacia abajo para saber de qué es cada uno. |
| **`Tabla`** + `TablaCabecera` · `Fila` · `Th` · `Td` | Datos tabulares de verdad (hoy solo *Entender*) | `numerica` en `Th`/`Td` alinea a la derecha **y** fija el ancho de los dígitos: es una sola decisión, no dos clases. |
| **`Skeleton`** / **`SkeletonCard`** | Dentro de un `loading.tsx` | El esqueleto compartido de `(zonas)/` es genérico a propósito. Si una pantalla merece su silueta exacta, le ponés su propio `loading.tsx` al lado de su `page.tsx`. |
| **`Modal`** | Ver o editar un registro | **Uno por lista, no uno por fila** (ADR-039). |
| **`Borrar`** | Borrar algo | Confirma **en el lugar**: el botón se reemplaza por la pregunta. Nunca `window.confirm`. |
| **`Copiar`** | Copiar al portapapeles | La confirmación es el propio botón cambiando de texto 2s. **No hay toasts en el cockpit y es a propósito.** |
| **`Select`** | Elegir de una lista | `<select>` nativo: trae teclado, tipeo y el picker del sistema en móvil. No metas un combobox de librería. |
| **`NavZonas`** | (solo el layout) | Marca la zona activa con `usePathname`. Filtra el servidor, no él. |

### Badge y Alert: usá la variante del estado

```tsx
<Badge variant="exito">Terminó bien</Badge>
<Alert variant="atencion">…</Alert>
```

Variantes disponibles en los dos: `exito` · `en-curso` · `atencion` · `destructive` (+ `destacado`
en Badge). El `<Alert>` es **el sustituto del toast** en todo el cockpit, así que es la pieza que
le contesta a la gente: un aviso que pasa desapercibido no contesta nada.

### Botones: que se note cuál es la acción

- **`default`** (índigo, con sombra) para **la** acción de la pantalla. Una por pantalla.
- `outline` / `ghost` para todo lo demás.
- `size="lg"` cuando además es la acción principal de un formulario o de una card.
- Si antes de apretarlo cuesta plata (Correr, Buscar cuentas nuevas): **confirma primero**, en el
  lugar, como hace `boton-correr.tsx`.

---

## 5. Íconos

`lucide-react`, ya instalado. **Un ícono por concepto, el mismo en todo el cockpit** — si
*Referentes* es `Radio` en el nav, es `Radio` en la tarjeta del índice y en su encabezado.

| Zona | Ícono | | Pantalla | Ícono |
|---|---|---|---|---|
| Operar | `Gauge` | | Feed | `ListChecks` |
| Curar | `ListChecks` | | Descartes | `Filter` |
| Transcribir | `Captions` | | Históricos | `Archive` |
| Entender | `ChartColumn` | | Voces | `Mic` |
| Ajustes | `Settings` | | Referentes | `Radio` |
| | | | Sugeridos | `Inbox` |
| | | | Motor | `SlidersHorizontal` |
| | | | Equipo | `Users` |
| | | | Colecciones | `Library` |
| | | | Corridas | `History` |

Tamaños: `size-4` en nav y botones, `size-5` en el círculo de un `EstadoVacio`, `size-6` en el
`Encabezado`. Siempre con `aria-hidden` cuando al lado hay texto que dice lo mismo.

---

## 6. Lo que NO se rompe

Estas no son preferencias estéticas: son decisiones de producto con su historia. Un rediseño
ingenuo las pisa.

- **La tarjeta calificada no se va del mazo.** Se marca y se atenúa en su lugar hasta cambiar de
  filtro o recargar, y **re-clickear otro emoji es el deshacer**. Sin toast, sin máquina de undo
  (`curar/feed/mazo.tsx`, `tarjeta.tsx`).
- **Los contadores de los chips salen de la tabla**, no del filtro abierto.
- **Calificar es optimista** y se revierte si falla. Nunca queda mintiendo.
- **Ningún `href` ni `revalidatePath` se escribe a mano**: se arman con `domain/rutas.ts`.
- **Las miniaturas van por `/api/miniatura`**, nunca directo al CDN (ADR-037).
- **El nav solo esconde; el servidor impide.** Cada `page.tsx` exige su zona y su tenant.

---

## 7. Checklist de una pantalla nueva

1. Abre con `<Encabezado>` (título, bajada, ícono, y la acción si tiene una sola clara).
2. Su estado vacío es un `<EstadoVacio>` **que dice qué hacer**.
3. Los colores salen de tokens. Cero `text-red-500`, cero `bg-amber-100`.
4. Los números que se actualizan llevan `tabular-nums`.
5. Si tarda, tiene esqueleto (o hereda el de `(zonas)/loading.tsx`).
6. **Se mira a 390px de ancho.** El equipo entra desde el celular.
7. Se navega con Tab y el foco se ve (`focus-visible:ring-3 ring-ring/50`).
8. Las palabras técnicas, o se traducen, o se explican donde aparecen — **y la traducción vive en
   `domain/`**. Un tooltip no alcanza: en el celular no hay tooltip.
9. `npm run typecheck && npm test && npm run build` en verde.
10. Si tocaste dos pipelines, revisá **las dos** pantallas (`pantalla.tsx` y `pantalla-linkedin.tsx`).

---

## 8. Anti-patrones (todos estuvieron en este repo)

| ❌ | Por qué duele |
|---|---|
| Un número crudo con la explicación en un `title` | Era el `0.87` de cada tarjeta. En el celular no hay tooltip: la única cifra de la tarjeta era ilegible. |
| Estados que se distinguen solo por la palabra | `ok` se dibujaba con el gris neutro y `parcial` con un borde vacío. Había que leer fila por fila. |
| Cuatro cards del mismo peso | Era Operar. Nada decía cuál era la acción del día. |
| Un estado vacío que solo dice que no hay nada | *"Nada en este filtro."* Punto. Sin salida. |
| Pantalla muda mientras carga | No había un solo `loading.tsx`. El silencio se lee como "se colgó", y la reacción es volver a apretar. |
| Una etiqueta que le come el lugar al botón | *"Muy prometedor"* rompía a dos líneas y empujaba los tres emoji — el gesto que el equipo hace cientos de veces por semana. |
| Inventar una segunda metáfora | El cockpit ya decía "de más caliente a más frío". Meter *"Muy prometedor"* al lado era pedirle al equipo aprender dos vocabularios. |
| Reusar la escala de otra pantalla para un número parecido | El heat va de 0 a 1 y la relevancia de un descarte de 0 a 0.5. Mismos cortes = una categoría que nunca se usa, sin fallar. |
| Un doc que describe algo que la pantalla no muestra | El manual prometía Costos a quien no los ve. Es la familia de la `015`: texto que describe algo ausente. |

---

## 9. Una decisión que se toma con datos, no a ojo

Cuando un corte, un umbral o una categoría de presentación no sea obvio, **medilo contra prod
antes de elegirlo**. El caso que dejó la regla: los cortes de `nivelDeHeat`.

A ojo parecía que estaban mal, porque la primera pantalla del feed mostraba todas las tarjetas con
la misma etiqueta. Midiendo (86 candidatos, `curl` a PostgREST con el `.env`) resultó que la
distribución es **bimodal** — 32 abajo de 0.3, 50 arriba de 0.6, **2 en el medio** — y que los
cortes estaban bien: lo que pasaba es que el mazo está ordenado, así que arriba están todos los
altos. Scrolleando aparecía la transición.

**Ajustar el corte "porque se ve raro" habría roto una etiqueta que funcionaba.** El hallazgo y su
fecha quedaron escritos en `domain/feed.ts`, con el aviso de qué significaría que el valle se
llene.

## 10. Los números del cockpit son TRES escalas distintas

Tres pantallas muestran un número del motor, y **ninguna comparte escala con las otras**.
Mezclarlas es un bug mudo: la etiqueta sale, no falla, y miente.

| Dónde | Campo | Rango real (medido) | Cómo se dice | Traducción |
|---|---|---|---|---|
| Feed | `heat` | **0 – 1**, bimodal | Caliente · Tibio · Frío | `nivelDeHeat` |
| Descartes | `relevancia_score` | **0 – 0.50** (su techo es el umbral del gate) | Casi pasa · Cerca · Lejos | `nivelDeCercania` |
| Sugeridos | `afinidad` | **0.6 – 1** (abajo de 0.6 no se propone) | `75%` | — |

🩸 **El error que esto evita, y estuvo a punto de pasar:** reusar `nivelDeHeat` en Descartes era
lo natural —los dos son "qué tan bueno lo ve el motor"— y habría sido un desastre silencioso. Con
el corte alto en 0.66 y un máximo real de 0.50, **ningún descarte habría llegado nunca a la
categoría de arriba**: la etiqueta nace muerta y nadie se entera, porque no falla, solo dice
siempre lo mismo.

Y por qué Sugeridos **no** lleva etiqueta en palabras: la afinidad ya viene con su nombre adelante
y la lista está ordenada por ella. Ahí el problema era de formato (`0.75` y `0.7` son el mismo
dato escrito de dos formas), y se arregla con un porcentaje. **Una cuarta escala de adjetivos
sería una palabra más para aprender, no menos.**

👉 **La regla:** antes de traducir un número a palabras, **medí su rango real contra prod**. Son
dos minutos con `curl` y el `.env`, y es la diferencia entre una etiqueta que informa y una que
dice siempre lo mismo.

---

*Cambió algo de acá y no está escrito: actualizalo. Un sistema visual que la gente tiene que
adivinar mirando otras pantallas ya dejó de ser un sistema.*
