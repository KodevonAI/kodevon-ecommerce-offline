"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addItem, parseStored, removeItem, setQty as setQtyPure, type CartItem } from "@/lib/cart";

const STORAGE_KEY = "offline_cart";

type CartContextValue = {
  items: CartItem[];
  count: number;
  add: (item: CartItem, maxStock: number) => void;
  setQty: (variantId: number, qty: number, maxStock: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // almacenamiento lleno o bloqueado: el carrito sigue en memoria
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // Hidrata en el cliente (evita mismatch con el HTML del servidor) y escucha otras pestañas.
  useEffect(() => {
    setItems(readStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setItems(parseStored(e.key === null ? null : e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persistimos al mutar (no en un efecto) para no pisar lo guardado con [] antes de hidratar.
  // Escribir dos veces el mismo valor (StrictMode repite el updater) es inocuo.
  const update = useCallback((fn: (c: CartItem[]) => CartItem[]) => {
    setItems((c) => {
      const next = fn(c);
      writeStorage(next);
      return next;
    });
  }, []);

  const add = useCallback((item: CartItem, maxStock: number) => update((c) => addItem(c, item, maxStock)), [update]);
  const setQty = useCallback(
    (variantId: number, qty: number, maxStock: number) => update((c) => setQtyPure(c, variantId, qty, maxStock)),
    [update],
  );
  const remove = useCallback((variantId: number) => update((c) => removeItem(c, variantId)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartContextValue>(
    () => ({ items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear }),
    [items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
