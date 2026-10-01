import { test, expect } from "@playwright/test";

// Requiere Postgres real: se salta si no hay E2E_DATABASE_URL (ver global-setup.ts y playwright.config.ts).
test.skip(!process.env.E2E_DATABASE_URL, "E2E_DATABASE_URL no definida: flujo con base de datos omitido.");

const adminEmail = process.env.ADMIN_EMAIL ?? "admin-e2e@offline.co";
const adminPassword = process.env.ADMIN_PASSWORD ?? "e2e-password-123";

test("cliente pide, admin confirma y el stock baja", async ({ page, context }) => {
  // Cliente
  await page.goto("/producto/camiseta-e2e");
  await page.getByRole("button", { name: /negro/i }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: /agregar al carrito/i }).click();
  await page.goto("/checkout");
  await page.getByLabel(/nombre/i).fill("Cliente E2E");
  await page.getByLabel(/celular|teléfono/i).fill("300 123 4567");
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: /pedir por whatsapp/i }).click();
  expect((await popup).url()).toContain("wa.me/57");
  await expect(page).toHaveURL(/\/pedido\/OFF-\d{4}/);

  // Admin
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(adminEmail);
  await page.getByLabel(/contraseña/i).fill(adminPassword);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("/admin/pedidos?status=pending");
  await page.getByRole("link", { name: /OFF-\d{4}/ }).first().click();
  await page.getByRole("button", { name: /confirmar pedido/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirmar/i }).click();
  await expect(page.getByText(/confirmado/i).first()).toBeVisible();

  // Stock: 5 - 1 = 4 -> VariantPicker solo muestra "Quedan N" con N <= 3, así que se verifica en admin.
  await page.goto("/admin/productos");
  await page.getByRole("link", { name: /camiseta e2e/i }).first().click();
  await expect(page.getByRole("row", { name: /negro/i }).getByRole("cell", { name: /^4/ }).first()).toBeVisible();
});

test("admin sin sesión es redirigido al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
});
