"use client";

import { useState, type ReactNode } from "react";
import { CasillaSeleccion } from "@/components/video/seleccion";
import { cn } from "@/lib/utils";

// La tarjeta de video del sistema. **Una sola, en las tres pantallas** (ADR-072).
//
// Salió de `curar/feed/tarjeta.tsx`, que ya la tenía bien resuelta, con un solo cambio de forma: el
// pie, el badge y el subtítulo pasan a ser **slots**, porque lo que se puede hacer con un video
// cambia por pantalla (calificarlo en el Feed, reintentarlo en Transcribir, marcarlo como grabado en
// Históricos) mientras que cómo se ve el video no cambia nunca.
//
// 🔑 **Degrada sin mentir, y eso es lo que hace posible estandarizar.** Las tres fuentes saben cosas
// distintas: medido el 2026-08-21, Transcribir tiene **0 de 130** videos con título o referente y los
// links cargados a mano **3 de 294**. Nada se completa inventando — lo que falta se dibuja como
// falta, y la tarjeta sigue siendo reconocible.

export const miles = (n: number) => new Intl.NumberFormat("es-AR").format(n);

/**
 * Cómo se dibuja una tarjeta cuando le faltan datos.
 *
 * - `rica` (default): Feed e Históricos, donde un video PUEDE tener título y miniatura, así que la
 *   ausencia distingue una tarjeta de otra y se dice ("sin título", "sin miniatura").
 * - `cola`: Transcribir, donde NINGÚN video tiene esa metadata por diseño (el pegote no le compra
 *   nada a Apify). Ahí el placeholder es neutro y la URL es la identidad — decir "sin título" 100
 *   veces no informa, confunde. Ver `Miniatura` y el bloque del título.
 */
export type Variante = "rica" | "cola";

/** Lo que la tarjeta dibuja de un video. Subconjunto de `domain/video.ts`, todo opcional. */
export type VideoEnTarjeta = {
  titulo: string | null;
  referente: string | null;
  thumbnail: string | null;
  views?: number | null;
};

/**
 * La miniatura, con su fallback.
 *
 * Va por `/api/miniatura` y NO directo al CDN: Instagram manda
 * `cross-origin-resource-policy: same-origin`, así que el browser bloquea un `<img>` cross-origin
 * aunque la URL responda 200. El proxy además la copia a Storage la primera vez, porque la URL
 * firmada vence en ~5 días (ver `app/api/miniatura/route.ts`). `<img>` y no `next/image`: el
 * optimizador tampoco puede leer una URL firmada de terceros.
 */
function Miniatura({ video, variante = "rica" }: { video: VideoEnTarjeta; variante?: Variante }) {
  const [rota, setRota] = useState(false);

  // 4:5 y no 9:16: el video es vertical, pero una miniatura con la proporción real hace que una
  // sola fila de tarjetas llene la pantalla y la grilla deje de leerse como un conjunto. Se recorta
  // al centro, que es donde el reel pone el gancho.
  if (video.thumbnail && !rota) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/miniatura?u=${encodeURIComponent(video.thumbnail)}`}
        alt=""
        loading="lazy"
        // Si ni el proxy la consigue (URL vencida antes del primer cacheo), el ícono de imagen rota
        // se lee como "la app falló". Cae al mismo lugar que no tener miniatura.
        onError={() => setRota(true)}
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
    );
  }

  // 🎨 **En modo `cola` el placeholder NO dice "sin miniatura"** (opción A, 2026-09-09). En
  // Transcribir NINGÚN video tiene miniatura por diseño —el pegote no le compra metadata a Apify—,
  // así que "sin miniatura" no es información: es el mismo cartel en las 100 tarjetas, y se lee como
  // que algo falló. Un ícono de reproducción neutro dice "esto es un video en cola" sin prometer un
  // dato que esta pantalla nunca va a traer. En el Feed/Históricos (variante `rica`) sí se dice,
  // porque ahí la ausencia de miniatura SÍ distingue una tarjeta de otra.
  if (variante === "cola") {
    return (
      <div className="flex size-full items-center justify-center text-muted-foreground/40">
        <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    );
  }

  const inicial = (video.referente ?? video.titulo ?? "").replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center">
      <span className="text-lg font-semibold text-muted-foreground/70">{inicial || "?"}</span>
      <span className="text-[10px] leading-tight text-muted-foreground">
        {video.thumbnail ? "miniatura vencida" : "sin miniatura"}
      </span>
    </div>
  );
}

export function TarjetaVideo({
  video,
  variante = "rica",
  badge,
  subtitulo,
  aviso,
  pie,
  atenuada = false,
  error = null,
  onAbrir,
  seleccion,
}: {
  video: VideoEnTarjeta;
  /** Cómo degrada cuando faltan datos. Ver `Variante`. `cola` es para Transcribir. */
  variante?: Variante;
  /** Sobre la miniatura, arriba a la derecha: la calificación, "✓ grabado", el estado. */
  badge?: ReactNode;
  /** Reemplaza la línea de referente + vistas. Sin esto se dibuja la de por defecto. */
  subtitulo?: ReactNode;
  /**
   * Una advertencia sobre el video, debajo del subtítulo y **fuera del `truncate`**.
   *
   * Va en su propia ranura y no dentro de `subtitulo` porque esa línea se corta a una sola con
   * ellipsis: un aviso truncado es un aviso que nadie lee. El primer caso es "esto es el mismo
   * video que uno que ya calificaste" (ADR-086).
   */
  aviso?: ReactNode;
  /** El pie de la tarjeta: las acciones de cada pantalla. Sin esto no se dibuja el borde. */
  pie?: ReactNode;
  /** Ya se despachó: se atenúa y se queda en su lugar (no se va de la grilla). */
  atenuada?: boolean;
  error?: string | null;
  onAbrir: () => void;
  /**
   * Modo selección prendido: la tarjeta **marca en vez de abrir**.
   *
   * 🔑 Es un solo control y no dos, a propósito. Una casilla chiquita al lado de una tarjeta que
   * sigue abriendo obliga a apuntar a 20×20 px para hacer lo único que se está haciendo en ese
   * momento; con el modo prendido, el blanco es la tarjeta entera. Es el patrón que ya conocen de
   * las fotos del teléfono. Sin esta prop la tarjeta se comporta exactamente como antes.
   */
  seleccion?: { marcado: boolean; onAlternar: () => void };
}) {
  const marcado = seleccion?.marcado ?? false;
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card transition-opacity",
        atenuada && "opacity-60",
        marcado && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={seleccion ? seleccion.onAlternar : onAbrir}
        className="group text-left"
        // En modo selección el botón no navega: es un interruptor, y `aria-pressed` es lo que se lo
        // dice al lector de pantalla (la casilla es decorativa, ver `CasillaSeleccion`).
        aria-pressed={seleccion ? marcado : undefined}
        // Sin título el `aria-label` diría "Abrir" a secas. El referente es lo siguiente que
        // identifica al video para quien navega con lector de pantalla.
        aria-label={`${seleccion ? (marcado ? "Quitar de la selección" : "Seleccionar") : "Abrir"} ${
          video.titulo ?? video.referente ?? "el video"
        }`}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          <Miniatura video={video} variante={variante} />
          {seleccion && <CasillaSeleccion marcado={marcado} />}
          {badge && (
            <span className="absolute right-1.5 top-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-lg shadow-sm">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1 p-2.5">
          {/* 🔴 Un video sin título dice que no lo tiene. **NUNCA se cae a la URL**: `outputs` lo
              hace hoy en 129 filas y ese disfraz fue lo que produjo el falso positivo de la
              medición del 21/08 (ADR-072 §4). Una pantalla que muestra una url donde dice "título"
              entrena a la gente a no leer ese campo.
              🎨 **En `cola` no se dibuja el "sin título" itálico** (opción A, 2026-09-09): en
              Transcribir NINGÚN video tiene título por diseño, así que el cartel se repetiría en las
              100 tarjetas sin informar. Ahí la identidad es la URL, que va en `subtitulo` abajo, y
              se le da el peso de título (no atenuada). */}
          {video.titulo ? (
            <p className="line-clamp-2 text-sm font-medium leading-snug">{video.titulo}</p>
          ) : variante === "cola" ? null : (
            <p className="text-sm italic leading-snug text-muted-foreground">sin título</p>
          )}
          <p
            className={cn(
              "truncate text-xs",
              // En `cola` sin título, la URL ES el título: se le da el color de texto principal en
              // vez del atenuado de un subtítulo secundario.
              variante === "cola" && !video.titulo
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {subtitulo ?? (
              <>
                {video.referente ?? "sin referente"}
                {video.views != null && ` · ${miles(video.views)} vistas`}
              </>
            )}
          </p>
          {aviso && <div className="pt-1">{aviso}</div>}
        </div>
      </button>

      {pie && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t px-2.5 py-1.5">
          {pie}
        </div>
      )}

      {error && <p className="px-2.5 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
