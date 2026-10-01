import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/admin/login/actions";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export function Nav() {
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm font-medium text-neutral-700 hover:text-neutral-950">
            {l.label}
          </Link>
        ))}
        <form action={logoutAction} className="ml-auto">
          <Button type="submit" variant="outline" size="sm">Salir</Button>
        </form>
      </div>
    </nav>
  );
}
