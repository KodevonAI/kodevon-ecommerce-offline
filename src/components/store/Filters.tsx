import Link from "next/link";
import { sortSizes } from "@/lib/sizes";
import { formatCop } from "@/lib/money";

export type FilterOptions = {
  categories: { slug: string; name: string }[];
  sizes: string[];
  colors: { name: string; hex: string }[];
};

/** Valores ya validados que vienen de la URL. */
export type ActiveFilters = {
  category?: string; size?: string; color?: string; min?: number; max?: number;
  sale?: boolean; q?: string; sort?: "new" | "price_asc" | "price_desc";
};

const SORTS = [
  { value: "new", label: "Más nuevos" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
] as const;

function toQuery(f: ActiveFilters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.size) p.set("size", f.size);
  if (f.color) p.set("color", f.color);
  if (f.min !== undefined) p.set("min", String(f.min));
  if (f.max !== undefined) p.set("max", String(f.max));
  if (f.sale) p.set("sale", "1");
  if (f.q) p.set("q", f.q);
  if (f.sort && f.sort !== "new") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `/tienda?${s}` : "/tienda";
}

const pill =
  "t-pill inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Pill({ name, value, checked, children }: { name: string; value: string; checked: boolean; children: React.ReactNode }) {
  return (
    <label className="relative">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className={pill}>{children}</span>
    </label>
  );
}

export function Filters({ options, active }: { options: FilterOptions; active: ActiveFilters }) {
  const chips: { label: string; href: string }[] = [];
  const cat = options.categories.find((c) => c.slug === active.category);
  if (active.category) chips.push({ label: cat?.name ?? active.category, href: toQuery({ ...active, category: undefined }) });
  if (active.size) chips.push({ label: `Talla ${active.size}`, href: toQuery({ ...active, size: undefined }) });
  if (active.color) chips.push({ label: active.color, href: toQuery({ ...active, color: undefined }) });
  if (active.min !== undefined) chips.push({ label: `Desde ${formatCop(active.min)}`, href: toQuery({ ...active, min: undefined }) });
  if (active.max !== undefined) chips.push({ label: `Hasta ${formatCop(active.max)}`, href: toQuery({ ...active, max: undefined }) });
  if (active.sale) chips.push({ label: "En oferta", href: toQuery({ ...active, sale: undefined }) });
  if (active.q) chips.push({ label: `“${active.q}”`, href: toQuery({ ...active, q: undefined }) });

  return (
    <div className="t-rule-y">
      <details className="group">
        <summary className="flex h-12 cursor-pointer font-semibold list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-ink">
          <span>
            Filtrar y ordenar
            {chips.length > 0 && <span className="ml-2 text-mute tabular-nums">({chips.length})</span>}
          </span>
          <span aria-hidden className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
        </summary>

        <form method="get" action="/tienda" className="grid gap-8 pb-8 pt-2 md:grid-cols-2 lg:grid-cols-4">
          <Group legend="Categoría">
            <Pill name="category" value="" checked={!active.category}>Todas</Pill>
            {options.categories.map((c) => (
              <Pill key={c.slug} name="category" value={c.slug} checked={active.category === c.slug}>{c.name}</Pill>
            ))}
          </Group>

          <Group legend="Talla disponible">
            <Pill name="size" value="" checked={!active.size}>Todas</Pill>
            {sortSizes(options.sizes).map((s) => (
              <Pill key={s} name="size" value={s} checked={active.size === s}>{s}</Pill>
            ))}
          </Group>

          <Group legend="Color">
            <Pill name="color" value="" checked={!active.color}>Todos</Pill>
            {options.colors.map((c) => (
              <Pill key={c.name} name="color" value={c.name} checked={active.color === c.name}>
                <span aria-hidden className="mr-2 size-3.5 rounded-full t-dot" style={{ backgroundColor: c.hex }} />
                {c.name}
              </Pill>
            ))}
          </Group>

          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Precio (COP)</legend>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="f-min">Precio mínimo</label>
                <input id="f-min" name="min" type="number" inputMode="numeric" min={0} step={1000} placeholder="Mínimo…" defaultValue={active.min}
                  className="h-10 w-full min-w-0 t-field px-3 text-sm tabular-nums" />
                <span aria-hidden className="text-mute">–</span>
                <label className="sr-only" htmlFor="f-max">Precio máximo</label>
                <input id="f-max" name="max" type="number" inputMode="numeric" min={0} step={1000} placeholder="Máximo…" defaultValue={active.max}
                  className="h-10 w-full min-w-0 t-field px-3 text-sm tabular-nums" />
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" name="sale" value="1" defaultChecked={active.sale} className="size-4 accent-ink" />
              Solo productos en oferta
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="f-q" className="text-sm font-medium">Buscar</label>
            <input id="f-q" name="q" type="search" defaultValue={active.q} placeholder="Nombre del producto…" maxLength={80} autoComplete="off" spellCheck={false}
              className="h-10 t-field px-3 text-sm" />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="f-sort" className="text-sm font-medium">Ordenar por</label>
            <select id="f-sort" name="sort" defaultValue={active.sort ?? "new"}
              className="h-10 t-field px-3 text-sm">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-4 md:col-span-2 lg:col-span-2 lg:justify-end">
            <Link href="/tienda" className="h-11 px-2 text-sm leading-[2.75rem] underline underline-offset-4">Limpiar filtros</Link>
            <button type="submit" className="h-11 press rounded-full px-6 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Aplicar filtros
            </button>
          </div>
        </form>
      </details>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2 pb-4" aria-label="Filtros activos">
          {chips.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="t-chip h-8 gap-2 px-3 text-sm hover:opacity-80" aria-label={`Quitar filtro ${c.label}`}>
                {c.label}
                <span aria-hidden>×</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/tienda" className="inline-flex h-8 items-center px-2 text-sm underline underline-offset-4">Limpiar filtros</Link>
          </li>
        </ul>
      )}
    </div>
  );
}
