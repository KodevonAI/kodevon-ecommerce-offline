"use client";

import { useState } from "react";
import { ProductImage } from "./ProductImage";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? null;
  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <div className="flex-1">
        <ProductImage src={main} name={name} priority sizes="(min-width: 768px) 55vw, 100vw" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-visible" aria-label="Fotos">
          {images.map((src, i) => (
            <li key={src} className="w-16 shrink-0 md:w-full">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === active}
                className={`block w-full transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${i === active ? "opacity-100 ring-1 ring-ink" : "opacity-60 hover:opacity-100"}`}
              >
                <ProductImage src={src} name={`${name}, foto ${i + 1}`} sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
