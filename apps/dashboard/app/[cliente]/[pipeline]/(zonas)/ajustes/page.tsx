import Link from "next/link";
import { Settings, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { Encabezado } from "@/components/ui/encabezado";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { comoRuta, rutaDe } from "@/domain/rutas";
import { pantallasDeAjustes, type PantallaAjustes } from "@/domain/pipelines";
import { puedeAdministrarEquipo } from "@/domain/permisos";
import { exigirTenant } from "@/lib/auth";

const ICONOS_AJUSTES: Record<PantallaAjustes, LucideIcon> = {
  motor: SlidersHorizontal,
  equipo: Users,
};

// El índice de Ajustes, la 5ª zona (ADR-060). Mismo molde que `curar/page.tsx`, y por la misma
// razón: **acá va solo el TEXTO**. Cuáles existen lo decide `domain/pipelines.ts`, que es la misma
// fuente que consulta la guardia del servidor (`exigirPantallaDeAjustes`). Dos listas —la que se
// dibuja y la que de verdad existe— divergen solas, y el síntoma sería una tarjeta que lleva a un
// redirect.
//
// El `Record<PantallaAjustes, …>` es exhaustivo: agregar una pantalla al dominio **no compila**
// hasta escribirle su copy.
type Copy = { titulo: string; descripcion: string };

const COPY: Record<PantallaAjustes, Copy> = {
  motor: {
    titulo: "Motor",
    descripcion:
      "Las perillas del sistema: qué tan exigente es el filtro y en qué plataformas busca. Cuántos videos trae cada proyecto se decide en Voces y proyectos.",
  },
  equipo: {
    titulo: "Equipo",
    descripcion:
      "Quiénes entran a esta empresa y con qué permisos. Invitar manda un mail con el acceso; quitarlo corta la entrada al toque.",
  },
};

export default async function AjustesPage({
  params,
}: {
  params: Promise<{ cliente: string; pipeline: string }>;
}) {
  const { cliente, pipeline } = await params;
  const { cockpit, rol } = await exigirTenant("ajustes", cliente, pipeline);
  const base = comoRuta(cockpit);

  // Las dos condiciones de la guardia, dibujadas: lo que el pipeline implementa Y lo que el rol
  // alcanza. Si esto y `exigirPantallaDeAjustes` no coincidieran, un operador vería la tarjeta de
  // Equipo y comería un redirect al volver acá.
  const tarjetas = pantallasDeAjustes(cockpit.workflowId).filter(
    (p) => p !== "equipo" || puedeAdministrarEquipo(rol),
  );

  return (
    <div className="space-y-6">
      <Encabezado titulo="Ajustes" icono={Settings}>
        La configuración de esta empresa: cómo busca el motor y quién entra al cockpit.
      </Encabezado>

      {tarjetas.length === 0 ? (
        <EstadoVacio
          icono={Settings}
          titulo="No hay nada que configurar con tu rol en este pipeline."
        >
          No es un error ni un permiso faltante: este pipeline no declara pantallas de ajustes
          que tu rol alcance.
        </EstadoVacio>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tarjetas.map((pantalla) => {
            const Icono = ICONOS_AJUSTES[pantalla];
            return (
              <Link
                key={pantalla}
                href={rutaDe(base, `ajustes/${pantalla}`)}
                className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="h-full transition-all group-hover:border-primary/30 group-hover:shadow-md group-hover:ring-primary/20">
                  <CardHeader>
                    <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icono className="size-4.5" aria-hidden />
                    </div>
                    <CardTitle>{COPY[pantalla].titulo}</CardTitle>
                    <CardDescription>{COPY[pantalla].descripcion}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
