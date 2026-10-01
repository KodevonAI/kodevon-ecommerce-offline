import { test, expect, type Page } from "@playwright/test";

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
  await page.goto("/admin/pedidos?estado=pending");
  await page.getByRole("link", { name: /OFF-\d{4}/ }).first().click();
  await page.getByRole("button", { name: /confirmar pedido/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirmar/i }).click();
  await expect(page.getByText(/confirmado/i).first()).toBeVisible();

  // Stock: 5 - 1 = 4. En el editor de producto, las tallas guardadas muestran el stock como texto de la fila
  // (con +/− para ajustarlo), no como input.
  await page.goto("/admin/productos");
  await page.getByRole("link", { name: /camiseta e2e/i }).first().click();
  await expect(page.getByRole("row", { name: /^M\s*4(\s|$)/ })).toBeVisible();
});

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Contraseña").fill(adminPassword);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/);
}

test("admin crea un producto con color y talla, aparece en la tienda y lo elimina", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre", { exact: true }).fill("Chaqueta E2E Alta");
  await page.getByLabel("Precio (COP)").fill("120000");

  // Color por el selector nativo: el nombre se propone con el color más cercano de la paleta.
  await page.locator("input[type=color]").fill("#ff0000");
  await expect(page.getByLabel("Nombre del color")).toHaveValue("Rojo");

  // Talla M con stock inicial 2 (sin fotos).
  await page.getByRole("group", { name: "Tallas frecuentes" }).getByRole("button", { name: "M", exact: true }).click();
  await page.getByLabel("Stock inicial talla M").fill("2");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/productos\/\d+\?creado=1/);
  await expect(page.getByText("Producto creado").first()).toBeVisible();
  const productUrl = page.url();

  await page.goto("/tienda");
  await expect(page.getByText("Chaqueta E2E Alta").first()).toBeVisible();

  // Sin pedidos: se puede eliminar desde su página.
  await page.goto(productUrl);
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /sí, eliminar/i }).click();
  await page.waitForURL(/\/admin\/productos$/);

  await page.goto("/tienda");
  await expect(page.getByText("Chaqueta E2E Alta")).toHaveCount(0);
});

test("un producto con pedidos se archiva en vez de eliminarse", async ({ page }) => {
  // camiseta-e2e ya tiene el pedido del primer test (confirmado): el botón es "Archivar", no "Eliminar".
  await adminLogin(page);
  await page.goto("/admin/productos");
  await page.getByRole("link", { name: /camiseta e2e/i }).first().click();
  await expect(page.getByRole("button", { name: "Archivar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar", exact: true })).toHaveCount(0);
});

test("admin sin sesión es redirigido al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
});
