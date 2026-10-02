"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseFavorites, toggleFavorite } from "@/lib/favorites";

const STORAGE_KEY = "offline_favorites";

type FavoritesValue = { slugs: string[]; count: number; has: (slug: string) => boolean; toggle: (slug: string) => void };

const FavoritesContext = createContext<FavoritesValue | null>(null);

function read(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  // Hidrata en el cliente (evita mismatch con el HTML del servidor) y escucha otras pestañas.
  useEffect(() => {
    setSlugs(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setSlugs(parseFavorites(e.key === null ? null : e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((slug: string) => {
    setSlugs((cur) => {
      const next = toggleFavorite(cur, slug);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // almacenamiento lleno o bloqueado: los favoritos siguen en memoria
      }
      return next;
    });
  }, []);

  const value = useMemo<FavoritesValue>(
    () => ({ slugs, count: slugs.length, has: (s) => slugs.includes(s), toggle }),
    [slugs, toggle],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites debe usarse dentro de <FavoritesProvider>");
  return ctx;
}
