# ADR-105 — Las lecturas por colección piden por llave, no la tabla entera

> **Estado:** **Aceptada** (Mani, 10/11/2026). La migración `049` está aplicada y medida por su efecto: 1.966 de 1.966 filas con llave, índice creado, `anon` sin `EXECUTE` y PostgREST filtra por `video_key`.
> Toca [ADR-070](./ADR-070-la-marca-de-grabado-es-por-video.md) (el techo declarado de `outputs`)
> y [ADR-073](./ADR-073-la-coleccion-es-una-bolsa-de-videos.md).

## Contexto

El 10/11 el equipo de redes no pudo limpiar ni descargar el documento de una colección de 40 guiones.
Causa medida: `app.guiones_limpios` pasó de 1.000 filas (tiene 1.002) y el guard de
`lib/supabase/tope.ts` aborta a propósito cuando una lectura "traé todo" devuelve justo el tope de
PostgREST (`max-rows` = 1.000, medido el 31/08). El guard funcionó; el defecto era leer la tabla de la
empresa entera para usar 40 filas.

El mismo patrón estaba en cuatro lugares, y el más caro era `outputs`: para saber título y voz de los
videos de una colección se bajaba **todo** el histórico (1.966 filas, en páginas de 25 = ~79 viajes) y
se cruzaba en Node, porque `outputs` no tiene columna con la llave del video: en las 867 filas del feed
archivado `external_id` es el uuid del candidato, no el id del video.

## Decisión

**D1 — Las lecturas por colección piden por las llaves de la colección**, en lotes de 200 (el mismo
número de `quitarMiembros`, por el 414 de URL larga), agrupando por plataforma cuando la tabla guarda
`plataforma` y `external_id` por separado (los ids de Instagram y TikTok pueden coincidir). Un lote
devuelve ≤ 200 filas: el tope no puede truncarlo. Aplica a `guiones_limpios`, `videos_meta` y `outputs`.

**D2 — `public.outputs.video_key` es una columna GENERADA** (`049`): `app.clave_de_url(metadata->>'url_referente')`,
con índice `(instance_id, video_key)`. La calcula la base y no el escritor, porque n8n no puede importar
`domain/enlace.ts`: una columna común habría obligado a mantener la derivación en dos lenguajes y en
cada escritor presente y futuro. Una función SQL gemela de `claveDe`/`parsearEnlaces` (ADR-031) sigue
siendo una segunda copia de la regla, y por eso se midió: **1.966 de 1.966 filas dan la misma llave en
SQL y en TypeScript** (prueba en transacción revertida, 10/11).

**D3 — Lo que sigue leyéndose entero queda paginado, no truncado:** `leerMeta` (pantalla de históricos),
`leerMarcas` (`app.grabados`, se cruza con el histórico completo) y el feed vivo de `leerLoQueSeSabe`
(acotado por el barrido de 20 días). `leerTodo` pagina de a 1.000 con orden estable; el guard queda como
red de seguridad para lecturas nuevas.

## Consecuencias

- El costo de abrir, limpiar o descargar una colección depende de su tamaño y no del de la empresa.
- ⚠️ **Orden de despliegue: la `049` va ANTES del deploy del cockpit.** Sin la columna, PostgREST
  responde `42703` y las pantallas de colecciones se caen.
- Si `parsearEnlaces` cambia (una plataforma nueva, un formato de URL), `app.clave_de_url` tiene que
  cambiar en la misma entrega. `NULL` en `video_key` significa "no se sabe", nunca una llave inventada.
- **No resuelto:** `leerHistoricoCompleto` / `leerTodosLosAprobados` (pantalla de históricos y CSV)
  siguen paginando de a 25. Con `video_key` el filtro de esa pantalla puede volver a la query; es un
  cambio aparte.
