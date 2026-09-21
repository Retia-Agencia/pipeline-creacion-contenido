import { ChevronRight, CircleAlert, Gauge, MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarMagicLink, entrarConContrasena } from "./actions";

// El texto de cada estado vive acá y no en `domain/credenciales.ts` a propósito: el dominio decide
// QUÉ pasó (tres estados, sin filtrar quién existe) y la pantalla decide CÓMO se cuenta. Un dueño
// por hecho, que es la regla de docs del repo aplicada al copy.
const MENSAJES: Record<string, { titulo: string; detalle: string }> = {
  credenciales: {
    titulo: "Mail o contraseña incorrectos",
    detalle:
      "Fijate que sea el mail con el que te invitaron. Si nunca pusiste una contraseña, entrá con el link.",
  },
  espera: {
    titulo: "Demasiados intentos seguidos",
    detalle: "Esperá unos minutos y probá de nuevo. Es un límite de seguridad, no un error tuyo.",
  },
  suspendida: {
    titulo: "Esa cuenta está suspendida",
    detalle: "No podés entrar con ella. Avisale a Mani.",
  },
  enviado: {
    titulo: "Revisá tu mail",
    detalle: "Te mandamos un link para entrar. Vale por un rato; si expira, pedí otro.",
  },
  "no-enviado": {
    titulo: "No pudimos mandarte el link",
    detalle:
      "Fijate que sea el mail con el que te invitaron. Si el problema sigue, avisale a Mani.",
  },
  "email-invalido": {
    titulo: "Ese mail no parece válido",
    detalle: "Escribilo completo, por ejemplo nombre@agencia.com.",
  },
  "link-invalido": {
    titulo: "El link ya no sirve",
    detalle: "Los links de acceso vencen. Pedí uno nuevo acá abajo.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const mensaje = estado ? MENSAJES[estado] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        {/* La marca arriba y afuera de la card. Es la primera pantalla del sistema y la única sin
            nav: sin esto, la puerta de entrada no dice de dónde es. */}
        <div className="flex items-center justify-center gap-2.5 pb-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
            <Gauge className="size-5" aria-hidden />
          </div>
          <span className="text-lg font-semibold tracking-tight">Cockpit de contenido</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Con tu mail y tu contraseña.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={entrarConContrasena} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Tu mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nombre@agencia.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Tu contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  // `current-password` (y no `new-password`): es lo que hace que el gestor de
                  // contraseñas ofrezca la guardada en vez de proponer una nueva.
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Entrar
              </Button>
            </form>

            {/* El link sigue existiendo y no es un resto: es el camino de quien todavía no tiene
                contraseña —toda alta nueva empieza así— y el de quien la olvidó. Va plegado porque
                es la excepción, no la puerta. */}
            <details className="group/detalle">
              {/* `marker:content-none` + `[&::-webkit-details-marker]:hidden` matan el triangulito
                  nativo, que era lo único de esta pantalla que se veía sin diseñar. El ícono
                  propio gira al abrir, así que la afordancia no se pierde. */}
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 marker:content-none hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-3.5 shrink-0 transition-transform group-open/detalle:rotate-90"
                  aria-hidden
                />
                No tengo contraseña, o me la olvidé
              </summary>
              <form action={enviarMagicLink} className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Te mandamos un link para entrar sin contraseña. Una vez adentro podés ponerte una
                  en <span className="font-medium">Mi cuenta</span>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-link">Tu mail</Label>
                  <Input
                    id="email-link"
                    name="email"
                    type="email"
                    placeholder="nombre@agencia.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Mandame el link
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>
        {mensaje && (
          // "Revisá tu mail" es una buena noticia y el resto son tropiezos; con una sola card gris
          // los dos se leían igual y había que leer el título para saber cuál era.
          <Alert variant={estado === "enviado" ? "exito" : "destructive"}>
            {estado === "enviado" ? <MailCheck /> : <CircleAlert />}
            <AlertTitle>{mensaje.titulo}</AlertTitle>
            <AlertDescription>{mensaje.detalle}</AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
