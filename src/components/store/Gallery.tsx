"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ProductImage } from "./ProductImage";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const zoom = useRef<HTMLDialogElement>(null);
  const main = images[active] ?? null;
  return (
    <div className="flex flex-col gap-4 md:flex-row-reverse">
      <div className="t-lift flex-1">
        {main ? (
          <button
            type="button"
            onClick={() => zoom.current?.showModal()}
            aria-label={`Ampliar foto de ${name}`}
            className="block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            <ProductImage src={main} name={name} priority sizes="(min-width: 768px) 55vw, 100vw" />
          </button>
        ) : (
          <ProductImage src={main} name={name} priority sizes="(min-width: 768px) 55vw, 100vw" />
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto p-1 md:w-20 md:flex-col md:overflow-visible" aria-label="Fotos">
          {images.map((src, i) => (
            <li key={src} className="w-16 shrink-0 md:w-full">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === active}
                className={`t-thumb block w-full transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${i === active ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
              >
                <ProductImage src={src} name={`${name}, foto ${i + 1}`} sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {main && (
        <dialog
          ref={zoom}
          aria-label={`Foto ampliada de ${name}`}
          onClick={(e) => { if (e.target === e.currentTarget) zoom.current?.close(); }}
          className="t-frame t-panel m-auto max-h-[92dvh] w-[min(92vw,900px)] bg-paper p-0 backdrop:bg-ink/60 backdrop:backdrop-blur-sm [overscroll-behavior:contain]"
        >
          <div className="relative aspect-[4/5] max-h-[92dvh] w-full">
            <Image src={main} alt={name} fill sizes="92vw" className="object-contain" />
          </div>
          <button
            type="button"
            onClick={() => zoom.current?.close()}
            className="press-quiet absolute right-3 top-3 grid size-10 place-items-center rounded-full text-lg"
            aria-label="Cerrar foto ampliada"
          >
            <span aria-hidden>×</span>
          </button>
        </dialog>
      )}
    </div>
  );
}
