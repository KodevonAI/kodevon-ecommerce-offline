"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCartLines } from "@/app/(store)/carrito/actions";
import type { CartLine } from "@/server/catalog";
import { useCart } from "./CartProvider";

export type DisplayLine = CartLine & { qty: number };

/**
 * Carga los datos vivos de las líneas del carrito y los reconcilia:
 * quita lo no disponible (inactivo / sin stock / inexistente) y topa cantidades al stock, con avisos.
 */
export function useCartLines() {
  const { items, ready, setQty, remove } = useCart();
  const [fetched, setFetched] = useState<{ key: string; lines: CartLine[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [notices, setNotices] = useState<string[]>([]);

  const idsKey = useMemo(() => items.map((i) => i.variantId).sort((a, b) => a - b).join(","), [items]);

  useEffect(() => {
    if (!ready || !idsKey) return;
    let cancelled = false;
    setFailed(false);
    fetchCartLines(idsKey.split(",").map(Number))
      .then((lines) => { if (!cancelled) { setFetched({ key: idsKey, lines }); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [ready, idsKey, nonce]);

  // Reconciliación: solo sobre ids cubiertos por la última respuesta del servidor.
  useEffect(() => {
    if (!fetched) return;
    const covered = new Set(fetched.key.split(",").filter(Boolean).map(Number));
    const byId = new Map(fetched.lines.map((l) => [l.variantId, l]));
    const msgs: string[] = [];
    for (const it of items) {
      if (!covered.has(it.variantId)) continue;
      const l = byId.get(it.variantId);
      const label = l ? `${l.productName} (${l.colorName} / ${l.size})` : "Un producto";
      if (!l || !l.active || l.stock <= 0) {
        remove(it.variantId);
        msgs.push(`${label} ya no está disponible y lo quitamos del carrito.`);
      } else if (it.qty > l.stock) {
        setQty(it.variantId, l.stock, l.stock);
        msgs.push(`${label}: solo quedan ${l.stock}, ajustamos la cantidad.`);
      }
    }
    if (msgs.length) setNotices((n) => [...n, ...msgs]);
  }, [fetched, items, remove, setQty]);

  const lines = useMemo<DisplayLine[]>(() => {
    const byId = new Map((fetched?.lines ?? []).map((l) => [l.variantId, l]));
    return items.flatMap((it) => {
      const l = byId.get(it.variantId);
      return l && l.active && l.stock > 0 ? [{ ...l, qty: Math.min(it.qty, l.stock) }] : [];
    });
  }, [items, fetched]);

  const loading = !ready || (idsKey !== "" && fetched?.key !== idsKey && !failed);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const dismissNotices = useCallback(() => setNotices([]), []);
  const total = lines.reduce((t, l) => t + l.price * l.qty, 0);

  return { items, ready, lines, loading, failed, notices, dismissNotices, refresh, total };
}
