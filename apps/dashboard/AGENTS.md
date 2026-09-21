# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Antes de tocar la UI: el sistema visual

**Leé [`docs/design/sistema-visual.md`](../../docs/design/sistema-visual.md) antes de escribir o
cambiar una pantalla.** Tiene los tokens de color, los componentes que ya existen, los íconos por
zona, el checklist de una pantalla nueva y los anti-patrones. No es una guía de estilo opcional: es
el dueño de cómo se ve el cockpit.

Las tres reglas que más se rompen, para que no haga falta abrirlo por ellas:

1. **Ningún color se escribe en un `.tsx`.** Salen de los tokens de `app/globals.css`
   (`text-atencion-fuerte`, `bg-exito-suave`, `variant="exito"`), nunca `text-amber-700`.
2. **Antes de escribir un `div` con clases, fijate si el componente ya existe** en
   `components/ui/`: `Encabezado`, `EstadoVacio`, `Metrica`, `Tabla`, `Skeleton`, `Modal`,
   `Borrar`, `Copiar`, `Select`.
3. **Las palabras que traducen un concepto viven en `domain/`**, no en el JSX. Hay dos pipelines
   con pantallas gemelas: una frase escrita en el `.tsx` ya son dos frases.

Para **cambiar** la paleta (no para usarla) está
[`docs/design/brief-visual.md`](../../docs/design/brief-visual.md): se llena, se traduce a
`globals.css`, y las 12 pantallas cambian solas.
