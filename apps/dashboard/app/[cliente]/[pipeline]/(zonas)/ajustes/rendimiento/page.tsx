import Link from "next/link";
import { Gauge } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { comoRuta, rutaDe } from "@/domain/rutas";
import { exigirPantallaDeAjustes } from "@/lib/auth";
import { leerEtiquetasRendimiento } from "@/lib/rendimiento";
import { PantallaRendimiento } from "./pantalla";

export const dynamic = "force-dynamic";

export default async function RendimientoPage({
  params,
}: {
  params: Promise<{ cliente: string; pipeline: string }>;
}) {
  const { cliente, pipeline } = await params;
  const { ctx, cockpit } = await exigirPantallaDeAjustes("rendimiento", cliente, pipeline);
  const base = comoRuta(cockpit);
  let etiquetas;
  try {
    etiquetas = await leerEtiquetasRendimiento(ctx);
  } catch (e) {
    console.error("[rendimiento] no se pudieron leer las etiquetas:", e);
    etiquetas = null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={rutaDe(base, "ajustes")} className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold">
          <Gauge className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          Rendimiento
        </h1>
        <p className="text-muted-foreground">
          Las etiquetas que aparecen junto a las vistas de cada reel en el Feed.
        </p>
      </div>

      {etiquetas === null ? (
        <Alert>
          <AlertDescription>
            No se pudieron leer las etiquetas. Recargá la página; si sigue, avisale a un dev.
          </AlertDescription>
        </Alert>
      ) : (
        <PantallaRendimiento iniciales={etiquetas} />
      )}
    </div>
  );
}
