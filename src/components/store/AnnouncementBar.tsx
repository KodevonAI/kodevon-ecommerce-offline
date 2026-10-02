import Link from "next/link";

export function AnnouncementBar() {
  return (
    <div className="bg-shade px-4 py-2 text-center text-xs text-mute md:text-[13px]">
      Pide por WhatsApp y acordamos el envío contigo.{" "}
      <Link href="/#como-pedir" className="text-[color:var(--accent-link)] underline-offset-4 hover:underline">
        Cómo pedir <span aria-hidden>›</span>
      </Link>
    </div>
  );
}
