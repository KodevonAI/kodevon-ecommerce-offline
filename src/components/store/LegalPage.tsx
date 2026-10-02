export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[760px] px-4 pb-10 pt-8 md:px-8 md:pt-14">
      <h1 className="font-wide text-3xl md:text-5xl">{title}</h1>
      <p className="mt-5 text-sm text-mute">Última actualización: {updated}</p>
      <div className="mt-8 flex flex-col gap-8 leading-relaxed text-ink/90 [&_h2]:font-wide [&_h2]:mb-3 [&_h2]:text-xl [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
