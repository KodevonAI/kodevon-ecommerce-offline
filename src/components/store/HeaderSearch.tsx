"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Lupa del header: abre una barra de búsqueda bajo la cabecera (GET a /tienda?q=). */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="buscador"
        aria-label={open ? "Cerrar búsqueda" : "Buscar productos"}
        className="t-icon-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {open ? <X className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <Search className="size-[18px]" strokeWidth={1.75} aria-hidden />}
      </button>
      {open && (
        <div id="buscador" className="absolute inset-x-0 top-full border-b border-[color:var(--header-edge)] bg-paper">
          <form role="search" action="/tienda" method="get" className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 md:px-8">
            <Search className="size-5 shrink-0 text-mute" strokeWidth={1.75} aria-hidden />
            <label htmlFor="header-q" className="sr-only">Buscar productos</label>
            <input
              ref={input}
              id="header-q"
              name="q"
              type="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              placeholder="Buscar camisetas, buzos, pantalones…"
              className="h-10 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-mute"
            />
            <button type="submit" className="press h-9 shrink-0 rounded-full px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Buscar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
