import { cn } from "@/lib/utils";

// El bloque gris que late mientras carga.
//
// No existía nada de esto: **las 12 pantallas son `force-dynamic` y no había un solo
// `loading.tsx` ni un `<Suspense>` en toda la app**, así que al navegar la pantalla se quedaba
// con el contenido viejo hasta que el servidor contestaba. En el cockpit eso es peor que en otras
// apps porque varias pantallas tardan de verdad (Operar hace cuatro consultas en paralelo,
// Entender lee cinco vistas): el silencio se lee como "se colgó", y la respuesta natural es
// volver a apretar.

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // `aria-hidden`: para quien usa lector de pantalla esto no es contenido, es ruido. El
      // anuncio de "cargando" lo da el `role="status"` del contenedor, una sola vez.
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** El esqueleto de una tarjeta: título, dos líneas y un pie. Es la forma dominante del cockpit. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-xl bg-card p-5 shadow-sm shadow-foreground/5 ring-1 ring-foreground/8",
        className,
      )}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full max-w-lg" />
      <Skeleton className="h-3 w-2/3 max-w-sm" />
    </div>
  );
}
