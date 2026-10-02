const PHRASES = ["Pide por WhatsApp", "Sin cuentas ni contraseñas", "Tandas cortas", "Ropa para desconectarse"];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {PHRASES.map((t) => (
        <li key={t} className="flex items-center whitespace-nowrap">
          <span className="font-wide px-5 text-xs uppercase tracking-wide md:text-sm">{t}</span>
          <span aria-hidden className="text-pop-yellow">✦</span>
        </li>
      ))}
    </ul>
  );
}

export function Marquee() {
  return (
    <div className="pop-only marquee overflow-hidden border-b-[3px] border-ink bg-ink py-2 text-paper" role="region" aria-label="Avisos de la tienda">
      <div className="marquee-track">
        <Row />
        <Row hidden />
        <Row hidden />
        <Row hidden />
      </div>
    </div>
  );
}
