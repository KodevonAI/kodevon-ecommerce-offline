import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = 3200;
const DB_PORT = 3201;
const E2E_DB = process.env.E2E_DATABASE_URL;
const SECRET = "x".repeat(40);

// Proyecto "demo": storefront con fixtures en memoria (DEMO_MODE), sin base de datos.
// Proyecto "db": flujo completo cliente -> admin con Postgres real; solo se activa con E2E_DATABASE_URL.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    { name: "demo", testMatch: /storefront-demo/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}` } },
    { name: "db", testMatch: /flow\.spec/, use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DB_PORT}` } },
  ],
  webServer: [
    {
      command: `npx next dev -p ${DEMO_PORT}`,
      url: `http://localhost:${DEMO_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DEMO_MODE: "1", NEXT_DIST_DIR: ".next-e2e", DATABASE_URL: "postgres://u:p@localhost:5432/x", SESSION_SECRET: SECRET },
    },
    ...(E2E_DB
      ? [{
          command: `npx next dev -p ${DB_PORT}`,
          url: `http://localhost:${DB_PORT}`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NEXT_DIST_DIR: ".next-e2e-db",
            DATABASE_URL: E2E_DB,
            SESSION_SECRET: SECRET,
            ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin-e2e@offline.co",
            ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "e2e-password-123",
          },
        }]
      : []),
  ],
});
