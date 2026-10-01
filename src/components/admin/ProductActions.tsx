"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { deleteProductAction, toggleActive } from "@/app/admin/productos/actions";

type Result = { error?: string; ok?: string } | undefined;

function SubmitButton({ children, pendingText, variant }: {
  children: React.ReactNode; pendingText: string; variant?: "default" | "destructive";
}) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? pendingText : children}</Button>;
}

function ArchiveButton({ id, name, active, size }: { id: number; name: string; active: boolean; size: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  async function submit(fd: FormData) {
    await toggleActive(fd);
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={size} />}>{active ? "Archivar" : "Reactivar"}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{active ? `Archivar ${name}` : `Reactivar ${name}`}</DialogTitle>
          <DialogDescription>
            {active
              ? "Este producto tiene pedidos, así que no se puede eliminar. Al archivarlo se conserva el historial de pedidos; no se verá en la tienda."
              : "El producto volverá a verse en la tienda con sus fotos y su stock actual."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={String(!active)} />
          <DialogFooter>
            <SubmitButton pendingText={active ? "Archivando..." : "Reactivando..."}>
              {active ? "Sí, archivar" : "Sí, reactivar"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id, name, size }: { id: number; name: string; size: "sm" | "default" }) {
  const [state, action] = useActionState<Result, FormData>(deleteProductAction.bind(null, id), undefined);
  return (
    <>
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" size={size} />}>Eliminar</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {name}</DialogTitle>
            <DialogDescription>Se borrará el producto, sus fotos y su stock. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
          <form action={action}>
            <DialogFooter>
              <SubmitButton variant="destructive" pendingText="Eliminando...">Sí, eliminar</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {state?.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
    </>
  );
}

/** Producto sin pedidos: Eliminar. Con pedidos: Archivar/Reactivar (se conserva el historial). */
export function ProductActions({ id, name, active, hasOrders, size = "sm" }: {
  id: number; name: string; active: boolean; hasOrders: boolean; size?: "sm" | "default";
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {hasOrders
        ? <ArchiveButton id={id} name={name} active={active} size={size} />
        : <DeleteButton id={id} name={name} size={size} />}
    </div>
  );
}
