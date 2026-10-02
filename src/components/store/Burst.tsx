/** Estallido de cómic: estrella de 14 puntas con borde y texto encima. Decorativo salvo por su texto. */
const POINTS = "50.0,2.0 58.5,13.0 70.8,6.8 73.7,20.3 87.5,20.1 84.2,33.5 96.8,39.3 88.0,50.0 96.8,60.7 84.2,66.5 87.5,79.9 73.7,79.7 70.8,93.2 58.5,87.0 50.0,98.0 41.5,87.0 29.2,93.2 26.3,79.7 12.5,79.9 15.8,66.5 3.2,60.7 12.0,50.0 3.2,39.3 15.8,33.5 12.5,20.1 26.3,20.3 29.2,6.8 41.5,13.0";

export function Burst({ children, fill = "var(--pop-yellow)", className = "" }: { children: React.ReactNode; fill?: string; className?: string }) {
  return (
    <div className={`grid place-items-center ${className}`}>
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible drop-shadow-[3px_3px_0_var(--store-ink)]">
        <polygon points={POINTS} fill={fill} stroke="var(--store-ink)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="callout relative -rotate-6 px-2 text-center leading-[0.95] text-ink">{children}</span>
    </div>
  );
}
