import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { countOrders, listOrders, ORDERS_PAGE_SIZE, type OrderFilters } from "@/server/orders-query";
import { formatCop } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SP = Record<string, string | string[] | undefined>;

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};
const STATUS_KEYS = ["pending", "confirmed", "cancelled"] as const;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

/** "YYYY-MM-DD" interpretado como día de Bogotá (UTC-5); null si es inválido. */
function bogotaDay(s: string, end: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T${end ? "23:59:59.999" : "00:00:00.000"}-05:00`);
  if (Number.isNaN(d.getTime())) return null;
  // rechaza fechas desbordadas como 2026-02-31
  const back = new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  return back === s ? d : null;
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

export default async function PedidosPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const statusRaw = first(sp.estado);
  const status = (STATUS_KEYS as readonly string[]).includes(statusRaw) ? (statusRaw as OrderFilters["status"]) : undefined;
  const fromRaw = first(sp.desde);
  const toRaw = first(sp.hasta);
  const from = bogotaDay(fromRaw, false) ?? undefined;
  const to = bogotaDay(toRaw, true) ?? undefined;
  const q = first(sp.q).trim().slice(0, 100);
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

  const db = getDb();
  const filters = { status, from, to, q: q || undefined };
  const [first1, pendingCount] = await Promise.all([listOrders(db, { ...filters, page }), countOrders(db, "pending")]);
  const { total } = first1;
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const curPage = Math.min(page, pages);
  // página fuera de rango: se consulta la última página en vez de mostrar una tabla vacía
  const { rows } = curPage === page ? first1 : await listOrders(db, { ...filters, page: curPage });

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("estado", status);
    if (from) u.set("desde", fromRaw);
    if (to) u.set("hasta", toRaw);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Pedidos</h1>
        <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="h-6 px-3 text-sm">
          {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
        </Badge>
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="space-y-1">
          <Label htmlFor="estado">Estado</Label>
          <select
            id="estado" name="estado" defaultValue={status ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={from ? fromRaw : ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to ? toRaw : ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Código, nombre o teléfono" />
        </div>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay pedidos con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = STATUS[r.status] ?? { label: r.status, variant: "secondary" as const };
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/admin/pedidos/${r.id}`} className="font-medium underline-offset-4 hover:underline">{r.code}</Link>
                    </TableCell>
                    <TableCell>{r.customerName}</TableCell>
                    <TableCell>{r.customerPhone}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>{formatCop(r.total)}</TableCell>
                    <TableCell>{fmt(r.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {total > 0 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-neutral-500">{total} pedidos · Página {curPage} de {pages}</span>
          <div className="flex gap-2">
            {curPage > 1 && <Link href={qs(curPage - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Anterior</Link>}
            {curPage < pages && <Link href={qs(curPage + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Siguiente</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
