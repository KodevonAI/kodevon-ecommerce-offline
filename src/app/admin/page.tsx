import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { getSummary, lowStock, resolveRange, salesByDay, topProducts, type RangeKey } from "@/server/stats";
import { formatCop } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCards } from "@/components/admin/StatCards";
import { SalesChart } from "@/components/admin/SalesChart";
import { RangeFilter } from "@/components/admin/RangeFilter";

type SP = Record<string, string | string[] | undefined>;
const KEYS = ["today", "7d", "30d", "month", "custom"] as const;
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = first(sp.range);
  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  const key: RangeKey = (KEYS as readonly string[]).includes(raw) ? (raw as RangeKey) : "30d";
  const range = resolveRange(key, new Date(), { from: fromRaw, to: toRaw });
  // si el rango custom era inválido, resolveRange cayó en 30d: reflejarlo en el filtro
  const day = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  const active = key === "custom" && (fromRaw !== day(range.from) || toRaw !== day(range.to)) ? "30d" : key;

  const db = getDb();
  const { lowStockThreshold } = await getSettings(db);
  const [summary, days, top, low] = await Promise.all([
    getSummary(db, range),
    salesByDay(db, range),
    topProducts(db, range, 5),
    lowStock(db, lowStockThreshold),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
      <RangeFilter active={active} from={day(range.from)} to={day(range.to)} />
      <StatCards {...summary} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Ventas por día</h2>
        {summary.orders === 0 ? (
          <p className="text-sm text-neutral-500">No hay ventas confirmadas en este rango.</p>
        ) : (
          <SalesChart data={days} />
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Top productos</h2>
          {top.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin ventas en este rango.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.units}</TableCell>
                      <TableCell className="text-right">{formatCop(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Stock bajo</h2>
          {low.length === 0 ? (
            <p className="text-sm text-neutral-500">Todo el inventario está por encima del umbral ({lowStockThreshold}).</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {low.map((l) => (
                <li key={l.variantId}>
                  <Link
                    href={`/admin/productos/${l.productId}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-neutral-900">{l.name}</span>
                      <span className="text-neutral-500"> · {l.size} · {l.colorName}</span>
                    </span>
                    {l.stock === 0 ? (
                      <Badge variant="destructive">Agotado</Badge>
                    ) : (
                      <Badge variant="secondary">{l.stock} uds</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
