import { cn } from "@/lib/utils";

// La tabla del cockpit. Solo la usa *Entender*, que es la única zona con datos tabulares de
// verdad: el resto del cockpit son listas de tarjetas, y eso está bien y no hay que convertirlo.
//
// Las dos `<table>` crudas que había (`secciones.tsx`) tenían la misma tira de clases repetida en
// cada `<th>` y cada `<td>`, y **la alineación numérica se escribía a mano columna por columna**:
// `text-right` acá, `tabular-nums` allá, y una de las dos tablas se había olvidado de
// `tabular-nums` en las dos primeras columnas numéricas. Por eso `numerica` es una prop y no una
// clase: alinear a la derecha y fijar el ancho de los dígitos son la misma decisión, y separarlas
// es lo que hace que una columna de números baile al cambiar de fila.

export function Tabla({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    // El scroll horizontal vive acá y no en la página: en un celular una tabla de cinco columnas
    // no entra, y lo que tiene que scrollear es la tabla, no la pantalla entera.
    <div className="-mx-1 overflow-x-auto px-1">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TablaCabecera({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-border", className)}
      {...props}
    />
  );
}

export function Fila({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/50 last:border-0 hover:bg-muted/40",
        className,
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  numerica = false,
  ...props
}: React.ComponentProps<"th"> & { numerica?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase first:pl-1 last:pr-1",
        numerica && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numerica = false,
  ...props
}: React.ComponentProps<"td"> & { numerica?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2 first:pl-1 last:pr-1",
        numerica && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
