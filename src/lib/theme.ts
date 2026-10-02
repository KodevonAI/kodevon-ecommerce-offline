export const THEMES = ["apple", "pop"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "offline-theme";
/** Tema por defecto cuando el visitante no ha elegido uno. */
export const DEFAULT_THEME: Theme = "apple";

export function parseTheme(v: string | undefined | null): Theme {
  return THEMES.find((t) => t === v) ?? DEFAULT_THEME;
}
