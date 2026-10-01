import { test, expect } from "@playwright/test";

// Requiere Postgres real: se salta si no hay E2E_DATABASE_URL (ver global-setup.ts y playwright.config.ts).
test.skip(!process.env.E2E_DATABASE_URL, "E2E_DATABASE_URL no definida: flujo con base de datos omitido.");

const adminEmail = process.env.ADMIN_EMAIL ?? "admin-e2e@offline.co";
const adminPassword = process.env.ADMIN_PASSWORD ?? "e2e-password-123";

test("cliente pide, admin confirma y el stock baja", async ({ page }) => {
  // Sin depender del popup real de wa.me: se captura la URL de window.open.
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return {} as Window;
    };
  });
  // Cliente
  await page.goto("/producto/camiseta-e2e");
  await page.getByRole("button", { name: "Negro", exact: true }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: /agregar al carrito/i }).click();
  await page.goto("/checkout");
  await page.getByLabel("Nombre").fill("Cliente E2E");
  await page.getByLabel("Celular").fill("300 123 4567");
  await page.getByRole("button", { name: /pedir por whatsapp/i }).click();
  await expect(page).toHaveURL(/\/pedido\/OFF-\d{4}/);
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(1);
  expect(opened[0].startsWith("https://wa.me/57")).toBe(true);

  // Admin
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Contraseña").fill(adminPassword);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/);
  await page.goto("/admin/pedidos?status=pending");
  await page.getByRole("link", { name: /OFF-\d{4}/ }).first().click();
  await page.getByRole("button", { name: /confirmar pedido/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirmar/i }).click();
  await expect(page.getByText(/confirmado/i).first()).toBeVisible();

  // Stock: 5 - 1 = 4. VariantPicker solo muestra "Quedan N" con N <= 3; en admin VariantGrid (StockCell)
  // pinta el stock como texto de una celda de tabla (no un input), así que se busca la celda "4".
  await page.goto("/admin/productos");
  await page.getByRole("link", { name: /camiseta e2e/i }).first().click();
  await expect(page.getByRole("row", { name: /negro/i }).getByRole("cell", { name: /^4/ }).first()).toBeVisible();
});

test("admin sin sesión es redirigido al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
});
