# Brief visual del cockpit

> **Llenalo y devolvelo.** De acá sale [`apps/dashboard/app/globals.css`](../../apps/dashboard/app/globals.css),
> que es el único lugar donde viven los colores, los radios y la tipografía del cockpit.
> Cambiar un valor acá cambia las 12 pantallas a la vez.
>
> ✅ **Estado: la propuesta de abajo se aplicó y se aprobó mirándola en pantalla el 2026-09-21.**
> O sea que este archivo ya no espera respuesta: es el formulario para **el próximo cambio**.
> Cómo se ve hoy el cockpit, y las reglas para no romperlo, están en
> [sistema-visual.md](sistema-visual.md) — ese es el doc que se lee antes de tocar una pantalla.
>
> Para cambiar algo: corregí acá el valor, traducilo a `globals.css` y verificá en pantalla.
> Lo que no corrijas queda como está.
>
> Para quién es el cockpit: Majo y Jero, el equipo de redes. No tocan n8n ni Supabase; esta es su
> única pantalla, y viven el 95% del tiempo en *Curar → Feed*.

---

## 1. Sensación general

¿Qué tiene que sentir Majo cuando abre el cockpit a las 9 de la mañana?

- [x] **Cálido y humano** — beiges, naranjas suaves, esquinas redondas. Tipo Notion.
- [ ] **Fresco y claro** — blancos amplios, un azul/verde limpio. Tipo Linear.
- [ ] **Vivo y editorial** — color saturado, tipografía grande, contraste. Tipo Spotify.
- [ ] Otra: _______________

Tres apps/webs que te gustan cómo se ven (links o nombres):

1. _______________
2. _______________
3. _______________

Una que NO querés que se le parezca, y por qué:

- _______________

---

## 2. Color principal

El color de las acciones: botones, links, el chip del filtro activo, la zona activa del menú.
Es el color que el equipo va a asociar con *"acá se aprieta"*.

- Color elegido: **`#524fdd`** — índigo cálido (`oklch(0.52 0.21 277)`)
- ¿Hay logo o marca de la agencia de donde sacarlo?
  - [ ] Sí, es: _______________
  - [ ] No, elegilo vos

**Propuesta si no ponés nada:** un **índigo cálido** (`#4F46E5` aprox.). Legible sobre blanco,
no corporativo-frío, y no compite con los emoji 🔥 👍 👎 del feed, que son el vocabulario del
equipo y se quedan como están.

---

## 3. Los colores que significan algo

Antes los cinco eran **todos grises** y había que leer la palabra para distinguirlos. Estos son
los que quedaron aplicados. Cada uno vive en `globals.css` en tres piezas (`--x`, `--x-suave`,
`--x-fuerte`): el sólido, el fondo del badge, y el texto sobre ese fondo.

| Significa | Token | Dónde se ve | Aplicado | Tu color |
|---|---|---|---|---|
| **Bien / terminado** | `exito` | corrida `ok`, aprobado 👍, transcripción lista | verde `oklch(0.62 0.145 155)` | |
| **En curso / esperando** | `en-curso` | corrida `en_curso`, cola de transcripción | azul `oklch(0.6 0.14 240)` | |
| **Ojo / a medias** | `atencion` | corrida `parcial`, *"no le alcanza"*, `0/62 auditados` | ámbar `oklch(0.72 0.155 75)` | |
| **Mal / falló** | `destructive` | corrida `fallo`, errores, borrar | rojo `oklch(0.577 0.22 27.5)` | |
| **Destacado** | `destacado` | el 🔥 del feed, "Caliente" | naranja `oklch(0.68 0.185 45)` | |

---

## 4. Tipografía

- [x] **Dejar Geist** (la de hoy: sans neutra, se lee bien)
- [ ] Cambiar a: _______________ (nombre de Google Fonts)
- [ ] Una para títulos y otra para el texto. Títulos: _______ / Texto: _______

Tamaño del texto general:

- [ ] Como está
- [x] **Más grande** — aplicado: `text-sm` pasó a 15px y `text-xs` a 13px

---

## 5. Forma y densidad

**Esquinas:**

- [x] **Redondeadas** (10px)
- [ ] Muy redondeadas (16px, más suave)
- [ ] Rectas (4px)

**Aire entre las cosas:**

- [ ] **Más aire** — menos cosas por pantalla, se scrollea más, intimida menos
- [ ] Como está
- [ ] Más compacto — entra más sin scrollear

**Ancho del contenido** (hoy: una columna al centro de 1024px):

- [x] **Más ancho** (1280px) — aplicado: `max-w-7xl`
- [ ] Como está
- [ ] Ancho completo

---

## 6. Navegación

Hoy es una barra arriba: Operar · Curar · Transcribir · Entender · Ajustes.
La zona en la que estás parado **no se distingue de las otras**.

- [x] **Arriba, con íconos** al lado del nombre y la zona activa marcada
- [ ] **Barra lateral** izquierda
- [ ] Como está

¿Los nombres de las zonas se quedan?

- [x] **Sí, ya son claros**
- [ ] Cambiar: Operar → _______ · Curar → _______ · Entender → _______

---

## 7. Modo oscuro

Hoy está **a medias**: los colores oscuros existen en el CSS pero no hay ningún botón ni ajuste
que los prenda, así que nadie los ve nunca.

- [x] **No por ahora** — sigue definido en el CSS y sin activar; falta el toggle, no los colores
- [ ] Sí, con un botón para cambiar
- [ ] Sí, que siga lo que tenga la computadora

---

## 8. Cada cliente con su color

El cockpit es multi-empresa (`retia`, `30x`, `estadox`). Dijiste carta libre, así que la
propuesta es **un solo look para todos**.

- [x] **Un solo look**
- [ ] Cada empresa con su color principal — pasame el de cada una:
  - retia: `#_______`
  - 30x: `#_______`
  - estadox: `#_______`

---

## 9. Lo que NO se toca

Esto lo escribo yo, para que lo sepas — no hay que llenarlo.

El rediseño **no cambia cómo funciona nada**:

- Los tres emoji siguen calificando igual, de un solo click.
- La tarjeta calificada **se queda en su lugar** atenuada, y volver a clickear otro emoji la
  re-califica: eso **es** el deshacer, y no se reemplaza por un toast.
- Los botones que cuestan plata (Correr, Buscar cuentas nuevas) siguen pidiendo confirmación.
- Borrar sigue preguntando en el lugar, sin ventanita del navegador.

¿Hay algo del funcionamiento actual que SÍ querés que cambie de paso?

- _______________
