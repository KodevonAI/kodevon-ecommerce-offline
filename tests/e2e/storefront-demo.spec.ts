import { test, expect } from "@playwright/test";

// Corre contra un servidor con DEMO_MODE=1 (catálogo en memoria, sin base de datos).

test("home carga", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Carrito vacío" })).toBeVisible();
});

test("tienda lista productos y el filtro por talla cambia resultados", async ({ page }) => {
  await page.goto("/tienda");
  const cards = page.locator('a[href^="/producto/"]');
  await expect(cards.first()).toBeVisible();
  const all = await cards.count();
  expect(all).toBeGreaterThan(3);

  await page.goto("/tienda?size=34");
  await expect(page.getByRole("list", { name: "Filtros activos" })).toContainText("Talla 34");
  const filtered = await page.locator('a[href^="/producto/"]').count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(all);
  await expect(page.getByRole("heading", { name: "Pantalón Cargo Pausa" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Camiseta Pausa" })).toHaveCount(0);
});

test("producto -> carrito -> checkout -> pedido", async ({ page }) => {
  // Intercepta window.open (sin salir a internet): guarda la URL de WhatsApp y devuelve un stub.
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return {} as Window;
    };
  });
  await page.goto("/producto/camiseta-pausa-negro");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: /agregar al carrito/i }).click();
  await expect(page.getByText("Agregado al carrito.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Carrito, 1 producto" })).toBeVisible();

  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Carrito" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Camiseta Pausa" })).toBeVisible();
  await expect(page.getByText("Total productos")).toBeVisible();
  await expect(page.getByText(/89\.000/).first()).toBeVisible();

  await page.goto("/checkout");
  await page.getByLabel("Nombre").fill("Cliente E2E");
  await page.getByLabel("Celular").fill("123");
  await page.getByRole("button", { name: /pedir por whatsapp/i }).click();
  await expect(page.locator("#phone-err")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByLabel("Celular").fill("300 123 4567");
  await page.getByRole("button", { name: /pedir por whatsapp/i }).click();
  await expect(page).toHaveURL(/\/pedido\/OFF-DEMO/);
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toContain("https://wa.me/57");
  await expect(page).toHaveURL(/\/pedido\/OFF-DEMO/);
  await expect(page.getByRole("heading", { name: "OFF-DEMO" })).toBeVisible();
  const body = page.locator("body");
  await expect(body).not.toContainText("Cliente E2E");
  await expect(body).not.toContainText("3001234567");
  await expect(body).not.toContainText("300 123 4567");
});

test("cambiar de color cambia de producto y conserva la talla", async ({ page }) => {
  await page.goto("/producto/camiseta-pausa-negro");
  await expect(page).toHaveTitle(/Negro/);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Hueso", exact: true }).click();
  await expect(page).toHaveURL(/\/producto\/camiseta-pausa-hueso\?talla=M/);
  await expect(page).toHaveTitle(/Hueso/);
  await expect(page.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("el catálogo muestra una tarjeta por color", async ({ page }) => {
  await page.goto("/tienda");
  await expect(page.getByRole("link", { name: /Camiseta Pausa/ })).toHaveCount(2);
  await page.goto("/tienda?color=Hueso");
  await expect(page.locator('a[href="/producto/camiseta-pausa-hueso"]')).toHaveCount(1);
  await expect(page.locator('a[href="/producto/camiseta-pausa-negro"]')).toHaveCount(0);
});

test("/admin/pedidos sin sesión redirige al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("pedido inexistente muestra 404", async ({ page }) => {
  const res = await page.goto("/pedido/OFF-9999");
  expect(res?.status()).toBe(404);
  await expect(page.getByText(/no existe/i)).toBeVisible();
});
