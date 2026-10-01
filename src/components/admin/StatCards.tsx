import Link from "next/link";
import { formatCop } from "@/lib/money";

type Props = { sales: number; orders: number; avgTicket: number; pending: number };

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{children}</div>
    </div>
  );
}

export function StatCards({ sales, orders, avgTicket, pending }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Ventas">{formatCop(sales)}</Card>
      <Card label="Pedidos confirmados">{orders}</Card>
      <Card label="Ticket promedio">{formatCop(avgTicket)}</Card>
      <Card label="Pedidos pendientes">
        <Link href="/admin/pedidos?estado=pending" className="underline-offset-4 hover:underline">
          {pending}
        </Link>
      </Card>
    </div>
  );
}
