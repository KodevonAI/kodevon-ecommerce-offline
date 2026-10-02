"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

export async function setTheme(formData: FormData) {
  const theme = parseTheme(String(formData.get("theme") ?? ""));
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
