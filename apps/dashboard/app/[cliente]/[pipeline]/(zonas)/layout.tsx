import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NavZonas } from "@/components/nav-zonas";
import {
  SelectorEquipo,
  SelectorPipeline,
  type OpcionCockpit,
} from "@/components/selector-cockpit";
import { usuarioActual } from "@/lib/auth";
import { cockpitsDe, resolverContexto } from "@/lib/tenant";
import { comoRuta } from "@/domain/rutas";
import { zonasDe } from "@/domain/roles";
import { zonasVisibles } from "@/domain/pipelines";
import { cerrarSesion } from "@/app/actions";

// El nav muestra solo las zonas del rol (la UI esconde); cada página además exige su zona **y su
// tenant** en el servidor (el servidor impide).
//
// ⚠️ **Este layout NO es la guardia de las páginas, y no hay que leerlo así:** en el App Router el
// layout y la página renderizan en paralelo, así que un chequeo acá no llega a tiempo para
// proteger a nadie. Valida para lo suyo —no dibujar el nav de un cockpit que no existe— y cada
// `page.tsx` valida lo suyo con `exigirTenant`. Es la misma división que ya tenía `proxy.ts`:
// chequeo optimista arriba, autoridad en cada página.
export default async function ZonasLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cliente: string; pipeline: string }>;
}) {
  const { cliente, pipeline } = await params;
  const usuario = await usuarioActual();

  const sesion = await resolverContexto(usuario, cliente, pipeline);
  // Un cockpit que no existe o que no es suyo sale por el mismo lado: a la raíz, que lo rebota al
  // que sí le toca. Sin decir cuál de las dos cosas fue (`lib/tenant.ts`).
  if (!sesion) redirect("/");

  // La intersección de ADR-056: lo que el rol alcanza Y lo que este pipeline implementa. Se keyea
  // por `workflowId` y no por el slug de la URL, porque el slug es de la INSTANCIA y renombrar un
  // cockpit no puede cambiarle las zonas.
  const zonas = zonasVisibles(zonasDe(sesion.rol), sesion.cockpit.workflowId);
  const cockpits = await cockpitsDe(usuario);
  // Del cockpit RESUELTO, no de los segmentos crudos: la URL es entrada, no verdad. Si lo que vino
  // no es exactamente lo que se resolvió, el nav tiene que apuntar a lo que se resolvió — si no, la
  // pantalla muestra los datos de un cockpit y los links de otro.
  const enRuta = comoRuta(sesion.cockpit);

  const opciones: OpcionCockpit[] = cockpits.map((c) => ({
    cliente: c.clientId,
    pipeline: c.slug,
    etiqueta: c.nombre ?? c.slug,
    empresa: c.clientId,
  }));

  // Las dos condiciones de ADR-056, y son independientes: se puede tener dos equipos con un
  // pipeline cada uno, o un equipo con dos pipelines. Cada control aparece por su cuenta.
  const equipos = new Set(opciones.map((o) => o.cliente)).size;
  const pipelinesDelEquipo = opciones.filter(
    (o) => o.cliente === enRuta.cliente,
  ).length;

  return (
    <div className="flex min-h-screen flex-col">
      {/* El header es lo único que se ve en las 12 pantallas, así que es donde más rinde el
          orden. Queda pegado arriba al scrollear: en el feed, que es largo, tener que volver
          hasta el principio para cambiar de zona era una fricción diaria. */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <NavZonas zonas={zonas} base={enRuta} />

          <div className="flex items-center gap-2">
            {/* Solo si hay a dónde saltar. La condición del equipo es además lo que hace que
                nadie vea el nombre de una empresa ajena: sin más de una membresía, no hay
                control. */}
            {equipos > 1 && (
              <SelectorEquipo cockpits={opciones} actual={enRuta} />
            )}
            {pipelinesDelEquipo > 1 && (
              <SelectorPipeline cockpits={opciones} actual={enRuta} />
            )}

            {/* Persona y rol son UN bloque y no dos cosas sueltas: juntos contestan "quién soy
                acá", que es una sola pregunta. El nombre sigue siendo el link a Mi cuenta —es
                donde todo el mundo busca lo suyo y evita sumar un ítem al nav— y no lleva gate
                de rol, porque la contraseña es de la persona. */}
            <Link
              href="/mi-cuenta"
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="hidden text-sm font-medium sm:inline">
                {usuario.nombre}
              </span>
              <Badge variant="secondary">{sesion.rol}</Badge>
            </Link>

            <form action={cerrarSesion}>
              <Button
                variant="ghost"
                size="icon-sm"
                type="submit"
                title="Salir"
                aria-label="Salir"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
