import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "month", label: "Este mes" },
] as const;

export function RangeFilter({ active, from, to }: { active: string; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rango">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/admin?range=${p.key}`}
            aria-current={active === p.key ? "true" : undefined}
            className={buttonVariants({ variant: active === p.key ? "default" : "outline", size: "sm" })}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <input type="hidden" name="range" value="custom" />
        <div className="space-y-1">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={from} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={to} required />
        </div>
        <Button type="submit" variant={active === "custom" ? "default" : "outline"} size="sm">
          Aplicar
        </Button>
      </form>
    </div>
  );
}
