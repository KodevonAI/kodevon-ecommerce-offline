"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (error.digest) console.error("admin error digest:", error.digest);
  }, [error.digest]);

  return (
    <div className="space-y-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Algo salió mal</h1>
      <p className="text-sm text-neutral-600">No se pudo cargar esta sección. Intenta de nuevo.</p>
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
