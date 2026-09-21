import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-lg border px-3.5 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        // El `<Alert>` es el sustituto del toast en todo el cockpit (no hay
        // sistema de toasts y es a propósito), así que es LA pieza que le
        // contesta a la gente. Un aviso que pasa desapercibido no contesta
        // nada: cada variante trae su fondo suave y su borde del mismo tono.
        destructive:
          "border-destructive/25 bg-destructive-suave text-destructive-fuerte *:data-[slot=alert-description]:text-destructive-fuerte/85 *:[svg]:text-current",
        exito:
          "border-exito/25 bg-exito-suave text-exito-fuerte *:data-[slot=alert-description]:text-exito-fuerte/85 *:[svg]:text-current",
        atencion:
          "border-atencion/30 bg-atencion-suave text-atencion-fuerte *:data-[slot=alert-description]:text-atencion-fuerte/85 *:[svg]:text-current",
        "en-curso":
          "border-en-curso/25 bg-en-curso-suave text-en-curso-fuerte *:data-[slot=alert-description]:text-en-curso-fuerte/85 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
