export default function TiendaLoading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-8" aria-busy="true">
      <span className="sr-only" role="status">Cargando productos…</span>
      <div aria-hidden className="animate-pulse">
        <div className="pb-6 pt-10 md:pt-14">
          <div className="h-9 w-48 bg-shade md:h-12 md:w-64" />
        </div>
        <div className="h-12 border-y border-line" />
        <ul className="grid grid-cols-2 gap-x-3 gap-y-10 pt-8 md:gap-x-5 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <div className="aspect-[4/5] bg-shade" />
              <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 bg-shade" />
                <div className="h-3 w-1/3 bg-shade" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
