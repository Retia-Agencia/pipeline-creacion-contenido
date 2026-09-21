import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive-suave text-destructive-fuerte focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        // ── Los estados del cockpit ──────────────────────────────────────────
        // Existen porque antes `ok` se dibujaba con `secondary` y `parcial` con
        // `outline`: o sea que "salió bien" y "quedó a medias" se distinguían
        // solo por la palabra de adentro. Los nombres son los de
        // `docs/design/brief-visual.md` §3 y los colores viven en `globals.css`.
        // Fondo `-suave` + texto `-fuerte` es el par que da contraste AA.
        exito: "bg-exito-suave text-exito-fuerte [a]:hover:bg-exito/20",
        "en-curso":
          "bg-en-curso-suave text-en-curso-fuerte [a]:hover:bg-en-curso/20",
        atencion:
          "bg-atencion-suave text-atencion-fuerte [a]:hover:bg-atencion/20",
        destacado:
          "bg-destacado-suave text-destacado-fuerte [a]:hover:bg-destacado/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
