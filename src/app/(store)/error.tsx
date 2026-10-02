"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Solo el digest: el mensaje y el stack no se muestran ni se registran en el cliente.
    if (error.digest) console.error("store error digest:", error.digest);
  }, [error.digest]);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-5 px-4 py-24 md:px-8 md:py-32">
      <h1 className="font-wide text-2xl md:text-3xl">Algo salió mal</h1>
      <p className="max-w-md text-ink/70">No pudimos cargar esta página. Intenta de nuevo; si sigue fallando, vuelve a la tienda.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-11 items-center press rounded-full px-6 text-sm font-medium"
        >
          Reintentar
        </button>
        <Link href="/tienda" className="inline-flex h-11 items-center press-quiet rounded-full px-6 text-sm font-medium">
          Ver tienda
        </Link>
      </div>
    </div>
  );
}
