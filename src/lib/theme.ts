export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "offline-theme";

/** Sin cookie válida devuelve undefined: el tema sigue al sistema (prefers-color-scheme). */
export function parseTheme(v: string | undefined | null): Theme | undefined {
  return THEMES.find((t) => t === v);
}
