import { setTheme } from "@/app/(store)/theme-actions";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "apple", label: "Sobrio" },
  { value: "pop", label: "Pop" },
];

export function ThemeSwitch({ theme }: { theme: Theme }) {
  return (
    <form action={setTheme} className="flex items-center gap-3 text-sm">
      <span id="estilo-label" className="text-[color:var(--footer-mute)]">Estilo</span>
      <div role="group" aria-labelledby="estilo-label" className="flex gap-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="theme"
            value={o.value}
            aria-pressed={theme === o.value}
            className="rounded-full border border-[color:var(--footer-line)] px-3 py-1 text-[color:var(--footer-mute)] transition-colors hover:text-[color:var(--footer-hover)] aria-pressed:border-[color:var(--footer-fg)] aria-pressed:text-[color:var(--footer-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--footer-fg)]"
          >
            {o.label}
          </button>
        ))}
      </div>
    </form>
  );
}
