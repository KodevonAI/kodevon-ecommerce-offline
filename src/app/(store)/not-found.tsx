import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-5 px-4 py-24 md:px-8 md:py-32">
      <p className="wordmark text-[26vw] t-404 md:text-[14rem]" aria-hidden>404</p>
      <h1 className="font-wide text-2xl md:text-3xl">Esta página no existe o el producto ya no está.</h1>
      <Link href="/tienda" className="inline-flex h-11 items-center press rounded-full px-6 text-sm font-medium">
        Ver tienda
      </Link>
    </div>
  );
}
