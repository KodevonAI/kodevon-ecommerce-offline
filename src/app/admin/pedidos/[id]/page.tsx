import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { getOrderDetail } from "@/server/orders-query";
import { formatCop } from "@/lib/money";
import { buildCustomerChatUrl } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderActions } from "@/components/admin/OrderActions";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const fmt = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d) : "—";

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const raw = (await params).id;
  const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const detail = await getOrderDetail(getDb(), id);
  if (!detail) notFound();
  const { order, items } = detail;
  const st = STATUS[order.status] ?? { label: order.status, variant: "secondary" as const };
  const isPending = order.status === "pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/pedidos" className="text-sm text-neutral-500 hover:underline">← Pedidos</Link>
        <h1 className="text-2xl font-semibold text-neutral-900">Pedido {order.code}</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{order.customerName}</p>
            <p className="text-neutral-600">{order.customerPhone}</p>
            <a
              href={buildCustomerChatUrl(order.customerPhone)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-2"}
            >
              Abrir chat
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fechas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Creado: {fmt(order.createdAt)}</p>
            <p>Confirmado: {fmt(order.confirmedAt)}</p>
            <p>Cancelado: {fmt(order.cancelledAt)}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Ítems</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Stock actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const missing = i.currentStock === null;
                  const short = isPending && !missing && i.currentStock! < i.qty;
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.productName}</TableCell>
                      <TableCell>{i.size}</TableCell>
                      <TableCell>{i.colorName}</TableCell>
                      <TableCell>{i.qty}</TableCell>
                      <TableCell>{formatCop(i.unitPrice)}</TableCell>
                      <TableCell>{formatCop(i.unitPrice * i.qty)}</TableCell>
                      <TableCell className={isPending && (missing || short) ? "font-medium text-red-600" : undefined}>
                        {missing ? "Variante eliminada" : i.currentStock}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-4 text-right text-lg font-semibold">Total: {formatCop(order.total)}</p>
        </CardContent>
      </Card>
      <OrderActions orderId={order.id} status={order.status} />
    </div>
  );
}
