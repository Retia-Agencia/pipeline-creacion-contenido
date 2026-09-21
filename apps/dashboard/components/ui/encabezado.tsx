import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// El encabezado de una pantalla: título, bajada y —si la hay— la acción principal.
//
// Estaba escrito a mano en cada `page.tsx` con la misma forma (`<div><h1 className="text-2xl
// font-semibold">…</h1><p className="text-muted-foreground">…</p></div>`), así que unificarlo no
// inventa un patrón: lo nombra.
//
// 🔑 **`accion` es lo que arregla la jerarquía de Operar.** Esa pantalla tenía cuatro `Card` del
// mismo peso y el botón ▶ enterrado adentro de la primera, así que nada decía cuál era la acción
// del día. Subir la acción al encabezado la pone donde el ojo llega primero.

export function Encabezado({
  titulo,
  children,
  accion,
  icono: Icono,
  className,
}: {
  titulo: string;
  /** La bajada: qué se hace en esta pantalla, en una frase. */
  children?: React.ReactNode;
  /** La acción principal de la pantalla, si tiene una sola clara. */
  accion?: React.ReactNode;
  icono?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          {Icono && (
            <Icono className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {titulo}
        </h1>
        {children && (
          <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {children}
          </div>
        )}
      </div>
      {accion && <div className="flex shrink-0 items-center gap-2">{accion}</div>}
    </div>
  );
}
