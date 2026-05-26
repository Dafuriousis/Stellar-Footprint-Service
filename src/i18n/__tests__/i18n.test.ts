import { resolveLocale, getTranslations } from "../index";

describe("resolveLocale", () => {
  it("defaults to en when no header", () => {
    expect(resolveLocale()).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });

  it("resolves exact match", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("en")).toBe("en");
  });

  it("resolves language from locale tag (es-MX)", () => {
    expect(resolveLocale("es-MX")).toBe("es");
  });

  it("resolves first matching language in list", () => {
    expect(resolveLocale("fr, es;q=0.9, en;q=0.8")).toBe("es");
  });

  it("falls back to en for unknown language", () => {
    expect(resolveLocale("fr, de")).toBe("en");
  });
});

describe("getTranslations", () => {
  it("returns English translations by default", () => {
    const t = getTranslations();
    expect(t.MISSING_XDR).toBe("Missing required field: xdr");
  });

  it("returns Spanish translations for es", () => {
    const t = getTranslations("es");
    expect(t.MISSING_XDR).toBe("Campo requerido faltante: xdr");
  });

  it("returns Spanish translations for es-MX", () => {
    const t = getTranslations("es-MX, en;q=0.8");
    expect(t.MISSING_XDR).toBe("Campo requerido faltante: xdr");
  });
});
