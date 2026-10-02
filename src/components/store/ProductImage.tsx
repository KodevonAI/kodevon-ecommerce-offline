import Image from "next/image";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Imagen 4:5 a sangre; sin foto muestra el nombre del producto recortado en tipografía expandida. */
export function ProductImage({
  src, name, sizes, priority, className = "",
}: { src: string | null; name: string; sizes: string; priority?: boolean; className?: string }) {
  if (src) {
    return (
      <div className={`t-frame relative aspect-[4/5] bg-shade ${className}`}>
        <Image src={src} alt={name} fill sizes={sizes} priority={priority} className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]" />
      </div>
    );
  }
  const tone = hash(name) % 6;
  const word = name.split(" ").slice(-1)[0] ?? name;
  return (
    <div
      role="img"
      aria-label={`${name} (sin foto)`}
      className={`t-frame @container relative flex aspect-[4/5] items-end ${className}`}
      style={{ backgroundColor: `var(--ph-bg-${tone})`, color: "var(--store-ink)" }}
    >
      <span aria-hidden className="pop-only halftone pointer-events-none absolute inset-0 opacity-[0.16] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <span
        aria-hidden
        className="wordmark pointer-events-none -ml-[0.04em] block translate-y-[14%] select-none whitespace-nowrap text-[30cqw] uppercase leading-[0.8]"
        style={{ color: `var(--ph-fg-${tone})`, fontSize: `min(30cqw, ${(104 / Math.max(word.length, 1)).toFixed(1)}cqw)` }}
      >
        {word}
      </span>
    </div>
  );
}
