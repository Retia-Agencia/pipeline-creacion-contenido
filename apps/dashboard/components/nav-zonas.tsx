"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Captions,
  ChartColumn,
  Gauge,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { rutaZona, type CockpitEnRuta } from "@/domain/rutas";
import type { Zona } from "@/domain/roles";
import { cn } from "@/lib/utils";

// El nav de zonas. Es cliente por una sola razón: **marcar en cuál estás parado**, que necesita
// `usePathname()`. La decisión de QUÉ zonas se dibujan la sigue tomando el servidor y llega por
// props ya resuelta — este componente no filtra nada, y no tiene que empezar a hacerlo.
//
// ⚠️ Sigue valiendo lo del layout: **el nav solo esconde, el servidor impide**. Cada `page.tsx`
// exige su zona y su tenant con `exigirTenant`. Si algún día alguien confía en esta lista como
// permiso, el agujero es de esa página, no de acá.

const ETIQUETAS: Record<Zona, string> = {
  operar: "Operar",
  curar: "Curar",
  transcribir: "Transcribir",
  entender: "Entender",
  ajustes: "Ajustes",
};

// Un ícono por zona. No son decoración: en una barra de cinco palabras parecidas, la forma es lo
// que el ojo encuentra antes que el texto, y es lo que hace que volver a la misma zona todos los
// días deje de ser un acto de lectura.
const ICONOS: Record<Zona, LucideIcon> = {
  operar: Gauge,
  curar: ListChecks,
  transcribir: Captions,
  entender: ChartColumn,
  ajustes: Settings,
};

export function NavZonas({
  zonas,
  base,
}: {
  zonas: readonly Zona[];
  base: CockpitEnRuta;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5" aria-label="Zonas del cockpit">
      {zonas.map((zona) => {
        const href = rutaZona(base, zona);
        // `startsWith` y no igualdad: estando en `curar/feed` la que tiene que quedar marcada es
        // `Curar`. El `/` del final evita que `curar` se marque desde una hipotética `curaduria`.
        const activa = pathname === href || pathname.startsWith(`${href}/`);
        const Icono = ICONOS[zona];

        return (
          <Link
            key={zona}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              activa
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icono className="size-4 shrink-0" aria-hidden />
            {/* El nombre se esconde en pantallas chicas y queda el ícono: cinco zonas con texto
                no entran en un celular, y romper a dos líneas es peor que mostrar la forma. */}
            <span className="hidden sm:inline">{ETIQUETAS[zona]}</span>
            <span className="sr-only sm:hidden">{ETIQUETAS[zona]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
