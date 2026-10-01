"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (error.digest) console.error("global error digest:", error.digest);
  }, [error.digest]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem" }}>
        <h1>Algo salió mal</h1>
        <p>Ocurrió un error inesperado.</p>
        <button type="button" onClick={() => reset()} style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
