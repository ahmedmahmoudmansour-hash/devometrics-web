import { describe, expect, it } from "vitest";
import { looksLike } from "./ai";

describe("question language check", () => {
  it("accepts a clean English question", () => {
    expect(looksLike("en", "A filling line has stopped twice. How would you investigate the repeat failure?")).toBe(true);
  });
  it("rejects an English question with a stray Chinese word", () => {
    expect(looksLike("en", "Explain how you would confirm that using records, 现场 observations, and other evidence.")).toBe(false);
  });
  it("rejects stray Cyrillic, Hebrew, Japanese and Korean", () => {
    expect(looksLike("en", "How would you проверить the result?")).toBe(false);
    expect(looksLike("en", "How would you בדוק the result?")).toBe(false);
    expect(looksLike("en", "How would you 確認 the result?")).toBe(false);
    expect(looksLike("en", "How would you 확인 the result?")).toBe(false);
  });
  it("rejects Arabic inside an English question, and English inside an Arabic one", () => {
    expect(looksLike("en", "How would you شرح the result to the team?")).toBe(false);
    expect(looksLike("ar", "How would you explain the result to the whole team today?")).toBe(false);
  });
  it("accepts an Arabic question, with a short Latin acronym", () => {
    expect(looksLike("ar", "كيف تتعامل مع توقف خط التعبئة المتكرر، وما الأدلة التي تجمعها قبل تحديد السبب؟")).toBe(true);
    expect(looksLike("ar", "كيف تشرح نتائج تحليل KPI لفريق التشغيل بطريقة واضحة ومفهومة للجميع؟")).toBe(true);
  });
  it("rejects an Arabic question with a stray Chinese word", () => {
    expect(looksLike("ar", "كيف تتعامل مع 现场 توقف خط التعبئة المتكرر وما الأدلة التي تجمعها؟")).toBe(false);
  });
  it("rejects text with no letters", () => {
    expect(looksLike("en", "12345 ?!")).toBe(false);
  });
});
