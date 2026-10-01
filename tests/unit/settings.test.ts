import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { getSettings, isStoreConfigured } from "@/server/settings";

describe("settings", () => {
  it("el número de WhatsApp está vacío por defecto tras migrar", async () => {
    const db = await makeTestDb();
    const s = await getSettings(db);
    expect(s.whatsappNumber).toBe("");
    expect(isStoreConfigured(s)).toBe(false);
  });
  it("isStoreConfigured exige un número", () => {
    expect(isStoreConfigured({ whatsappNumber: "3001234567" })).toBe(true);
    expect(isStoreConfigured({ whatsappNumber: "  " })).toBe(false);
  });
});
