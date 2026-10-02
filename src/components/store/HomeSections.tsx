import Image from "next/image";
import Link from "next/link";

export function Lookbook() {
  return (
    <section aria-labelledby="lookbook" className="mx-auto max-w-[1440px] px-4 pt-20 md:px-8 md:pt-32">
      <div className="grid gap-4 md:grid-cols-12 md:gap-5">
        <div className="reveal md:col-span-7">
          <div className="t-frame t-lift relative aspect-[5/6]">
            <Image
              src="/images/look-ruta-lenta.webp"
              alt="Mujer caminando por un sendero con pantalón cargo verde oliva y camiseta oversize color crema"
              fill
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-8 md:col-span-5 md:pt-24">
          <div className="reveal max-w-sm">
            <p className="text-sm font-medium text-[color:var(--accent-link)] md:text-base">Última tanda</p>
            <h2 id="lookbook" className="font-wide mt-4 text-3xl leading-[1.05] md:text-4xl">
              Hecha para caminar sin mirar el teléfono.
            </h2>
            <p className="mt-4 leading-relaxed text-ink/75">
              Algodón peinado de 220 g, cortes rectos y colores que no cansan. Producimos pocas unidades por modelo y, cuando se acaban, se acaban.
            </p>
            <Link href="/tienda?sort=new" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">
              Ver la tanda
            </Link>
          </div>
          <div className="t-frame t-lift reveal relative aspect-square w-3/5 self-end md:w-2/3">
            <Image
              src="/images/look-hueso.webp"
              alt="Mujer sentada contra un muro terracota con buzo y pantalón ancho color crema"
              fill
              sizes="(min-width: 768px) 28vw, 60vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Elige tu prenda y tu talla", body: "Arma el carrito con lo que quieras. No necesitas crear una cuenta." },
  { title: "Déjanos tu nombre y celular", body: "Es lo único que pedimos. Al enviar, se abre WhatsApp con tu pedido ya escrito." },
  { title: "Confirmamos contigo por WhatsApp", body: "Revisamos que haya unidades, y acordamos el envío y la forma de pago por ahí." },
];

export function HowToOrder() {
  return (
    <section id="como-pedir" aria-labelledby="como-pedir-titulo" className="mx-auto scroll-mt-20 max-w-[1440px] px-4 pt-20 md:px-8 md:pt-32">
      <div className="grid gap-10 md:grid-cols-12 md:gap-5">
        <div className="md:col-span-4">
          <h2 id="como-pedir-titulo" className="font-wide text-2xl md:sticky md:top-24 md:text-3xl">Cómo pedir</h2>
        </div>
        <ol className="t-rule-strong-t md:col-span-7 md:col-start-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 t-rule-b py-7 md:grid-cols-[5.5rem_minmax(0,1fr)] md:py-9">
              <span aria-hidden className="t-step">{i + 1}</span>
              <div>
                <h3 className="text-lg font-medium md:text-xl">{s.title}</h3>
                <p className="mt-2 max-w-md leading-relaxed text-ink/75">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
