import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// El estado vacío del cockpit.
//
// Existía copiado a mano en 10 archivos (`rounded-lg border border-dashed p-8 text-center`) y con
// dos calidades muy distintas: algunos ya explicaban bien por qué no hay nada —los de LinkedIn son
// los mejores escritos del repo— y otros decían "Nada en este filtro" y se terminaba ahí.
//
// 🔑 **La pieza que ninguno tenía es `accion`, y es la que importa.** Una pantalla vacía es el
// momento exacto en que alguien no sabe qué hacer, así que es donde más rinde decirlo. La regla al
// usarlo: si hay una próxima acción razonable, va; si de verdad no hay ninguna (el caso "ya
// terminaste"), se deja afuera y el vacío es una buena noticia, no un pedido.
//
// `titulo` dice QUÉ pasa en una línea, el cuerpo dice POR QUÉ. Esa división ya estaba en los
// estados vacíos de LinkedIn y es lo que se conserva.

export function EstadoVacio({
  icono: Icono,
  titulo,
  children,
  accion,
  className,
}: {
  /** Opcional: sin ícono el bloque sigue funcionando, con ícono se encuentra antes. */
  icono?: LucideIcon;
  /** Qué pasa, en una línea. */
  titulo: string;
  /** Por qué pasa. Acepta markup porque casi siempre hay un link adentro. */
  children?: React.ReactNode;
  /** La próxima acción. Un `<Button>`, un link, o nada si de verdad no hay ninguna. */
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-10 text-center",
        className,
      )}
    >
      {Icono && (
        <div
          className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icono className="size-5" />
        </div>
      )}
      <p className="text-sm font-medium">{titulo}</p>
      {children && (
        <div className="mx-auto mt-1.5 max-w-lg text-sm text-balance text-muted-foreground">
          {children}
        </div>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
