import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Un número que se lee de un vistazo. La forma ya existía suelta en *Entender*
// (`<p className="text-3xl font-semibold">{usd(total)}</p>` + una línea gris debajo); acá se
// nombra para que las próximas se vean igual.
//
// El orden es **etiqueta arriba, número abajo**, al revés de como estaba. Es a propósito: un
// número grande sin contexto obliga a leer hacia abajo para saber de qué es, y en una fila de
// tres o cuatro métricas eso se paga una vez por métrica. Con la etiqueta arriba, el ojo barre
// los números y solo baja al que le interesa.
//
// `tabular-nums` no es cosmético: sin él, una métrica que se actualiza sola (Operar refresca
// mientras hay una corrida viva) cambia de ancho al cambiar de dígito y la fila entera salta.

export function Metrica({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = "neutro",
  className,
}: {
  etiqueta: string;
  /** El número ya formateado. Formatear es del dominio, no de la presentación. */
  valor: React.ReactNode;
  /** La letra chica de abajo: contra qué se compara, de cuándo es el dato. */
  detalle?: React.ReactNode;
  icono?: LucideIcon;
  /** El color del número. `neutro` es el default y es lo correcto casi siempre. */
  tono?: "neutro" | "exito" | "atencion" | "problema";
  className?: string;
}) {
  const color = {
    neutro: "text-foreground",
    exito: "text-exito-fuerte",
    atencion: "text-atencion-fuerte",
    problema: "text-destructive-fuerte",
  }[tono];

  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {Icono && <Icono className="size-3.5 shrink-0" aria-hidden />}
        {etiqueta}
      </p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums tracking-tight",
          color,
        )}
      >
        {valor}
      </p>
      {detalle && (
        <p className="mt-0.5 text-sm text-muted-foreground">{detalle}</p>
      )}
    </div>
  );
}
