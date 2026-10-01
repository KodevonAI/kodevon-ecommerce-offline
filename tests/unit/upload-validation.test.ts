import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, blobFileName, validateImageFile } from "@/lib/upload";

const MB4 = 4 * 1024 * 1024;

describe("validateImageFile", () => {
  it("acepta jpg, jpeg, png y webp", () => {
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 100 })).toBeNull();
    expect(validateImageFile({ name: "a.JPEG", type: "image/jpeg", size: 100 })).toBeNull();
    expect(validateImageFile({ name: "foto.png", type: "image/png", size: 100 })).toBeNull();
    expect(validateImageFile({ name: "x.y.webp", type: "image/webp", size: 100 })).toBeNull();
  });
  it("rechaza ejecutables y tipos no permitidos", () => {
    expect(validateImageFile({ name: "virus.exe", type: "application/octet-stream", size: 100 })).toMatch(/virus\.exe: solo jpg, png o webp/);
    expect(validateImageFile({ name: "a.html", type: "text/html", size: 100 })).toMatch(/solo jpg, png o webp/);
    expect(validateImageFile({ name: "a.exe", type: "image/png", size: 100 })).toMatch(/extensión no coincide/);
  });
  it("rechaza extensión que no coincide con el tipo", () => {
    expect(validateImageFile({ name: "a.png", type: "image/jpeg", size: 100 })).toMatch(/a\.png: la extensión no coincide/);
    expect(validateImageFile({ name: "sinextension", type: "image/png", size: 100 })).toMatch(/extensión no coincide/);
  });
  it("límite de 4 MB inclusivo", () => {
    expect(MAX_UPLOAD_BYTES).toBe(MB4);
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: MB4 })).toBeNull();
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: MB4 + 1 })).toMatch(/a\.jpg: máximo 4 MB/);
  });
  it("rechaza archivos vacíos", () => {
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 0 })).toMatch(/a\.jpg: archivo vacío/);
  });
});

describe("blobFileName", () => {
  it("sanea caracteres raros", () => {
    expect(blobFileName("mi foto (1).jpg")).toBe("mi_foto__1_.jpg");
  });
  it("limita a 80 caracteres conservando la extensión", () => {
    const n = blobFileName(`${"a".repeat(300)}.webp`);
    expect(n.length).toBe(80);
    expect(n.endsWith(".webp")).toBe(true);
  });
  it("nombres cortos quedan intactos", () => {
    expect(blobFileName("a.png")).toBe("a.png");
  });
});
