import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// El esqueleto que ven TODAS las zonas mientras cargan.
//
// Va en `(zonas)/` y no en cada pantalla a propósito: un `loading.tsx` cubre todos los segmentos
// de abajo que no tengan el suyo, así que con este archivo las 12 pantallas dejan de mostrar el
// contenido viejo al navegar. Si alguna pantalla merece un esqueleto con su forma exacta —el feed
// es la candidata, que es una grilla de tarjetas y no una lista de cards— se le agrega el suyo al
// lado de su `page.tsx` y este deja de aplicarle.
//
// Por eso la forma de acá es **genérica a propósito**: encabezado más tres bloques. Dibujar la
// silueta exacta de una pantalla en el esqueleto compartido de las doce sería mentirle a once.
//
// El layout (header y nav) no parpadea: en el App Router el layout se queda montado e
// interactivo mientras el segmento de abajo carga, así que se puede cambiar de zona a mitad de
// una carga lenta sin esperarla.

export default function Cargando() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
