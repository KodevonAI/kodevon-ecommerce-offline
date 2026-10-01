import Image from "next/image";

// Tonos del placeholder: grises de papel y dos tintas oscuras, elegidos por hash del nombre (determinista).
const TONES = [
  { bg: "#ecebe5", fg: "#d9d8d0" },
  { bg: "#e3e2db", fg: "#cfcec5" },
  { bg: "#d7d6ce", fg: "#c4c3ba" },
  { bg: "#1c1c1b", fg: "#2c2c2a" },
  { bg: "#2a2a28", fg: "#3a3a37" },
];

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
      <div className={`relative aspect-[4/5] overflow-hidden bg-shade ${className}`}>
        <Image src={src} alt={name} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const tone = TONES[hash(name) % TONES.length];
  const word = name.split(" ").slice(-1)[0] ?? name;
  return (
    <div
      role="img"
      aria-label={`${name} (sin foto)`}
      className={`@container relative flex aspect-[4/5] items-end overflow-hidden ${className}`}
      style={{ backgroundColor: tone.bg }}
    >
      <span
        aria-hidden
        className="wordmark pointer-events-none -ml-[0.04em] block translate-y-[14%] select-none whitespace-nowrap text-[30cqw] uppercase leading-[0.8]"
        style={{ color: tone.fg }}
      >
        {word}
      </span>
    </div>
  );
}
