"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE } from "@/lib/theme";

/** Sol/luna: alterna claro y oscuro al instante y recuerda la elección en una cookie. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme;
    const dark = current === "dark" || (current !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Modo claro / oscuro"
      className="t-icon-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Moon className="theme-moon size-[18px]" strokeWidth={1.75} aria-hidden />
      <Sun className="theme-sun size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
