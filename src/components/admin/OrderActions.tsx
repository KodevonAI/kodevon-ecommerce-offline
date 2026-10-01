"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cancelOrderAction, confirmOrderAction } from "@/app/admin/pedidos/actions";

type Res = { ok: string } | { error: string };

export function OrderActions({ orderId, status }: { orderId: number; status: "pending" | "confirmed" | "cancelled" }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Res | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const run = (fn: (id: number) => Promise<Res>, close: (o: boolean) => void) => {
    startTransition(async () => {
      try {
        setResult(await fn(orderId));
      } catch {
        setResult({ error: "No se pudo completar la acción" });
      }
      close(false);
    });
  };

  const canConfirm = status === "pending";
  const canCancel = status === "pending" || status === "confirmed";
  const msg = result && ("error" in result ? result.error : result.ok);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canConfirm && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger render={<Button disabled={pending} />}>Confirmar pedido</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar pedido</DialogTitle>
                <DialogDescription>Se descontará el stock de los productos del pedido. ¿Continuar?</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button disabled={pending} onClick={() => run(confirmOrderAction, setConfirmOpen)}>
                  {pending ? "Confirmando..." : "Sí, confirmar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {canCancel && (
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger render={<Button variant="outline" disabled={pending} />}>Cancelar pedido</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar pedido</DialogTitle>
                <DialogDescription>
                  {status === "confirmed"
                    ? "El pedido ya estaba confirmado: al cancelarlo se devolverá el stock a los productos. ¿Continuar?"
                    : "El pedido quedará cancelado. No se modifica el stock porque aún no estaba confirmado. ¿Continuar?"}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" disabled={pending} onClick={() => run(cancelOrderAction, setCancelOpen)}>
                  {pending ? "Cancelando..." : "Sí, cancelar pedido"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p
        role={result && "error" in result ? "alert" : "status"}
        className={`min-h-5 text-sm ${result && "error" in result ? "text-red-600" : "text-green-700"}`}
      >
        {msg}
      </p>
    </div>
  );
}
