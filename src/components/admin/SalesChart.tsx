"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCop } from "@/lib/money";

type Row = { day: string; total: number; orders: number };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-03-12" -> "12 mar" */
function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;

export function SalesChart({ data }: { data: Row[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Ventas por día">
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e5e5" />
          <XAxis
            dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 12, fill: "#737373" }}
            tickLine={false} axisLine={{ stroke: "#d4d4d4" }} minTickGap={16}
          />
          <YAxis
            tickFormatter={compact} tick={{ fontSize: 12, fill: "#737373" }}
            tickLine={false} axisLine={false} width={56}
          />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            labelFormatter={(l) => shortDay(String(l))}
            formatter={(v) => [formatCop(Number(v)), "Ventas"]}
          />
          <Bar dataKey="total" fill="#404040" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
