const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildGeminiGenerateConfig,
  buildGeminiSectionPrompt,
} = require("./gemini.generator");

test("Gemini config includes googleSearch tool when search grounding is enabled", () => {
  const config = buildGeminiGenerateConfig({
    maxOutputTokens: 16000,
    thinkingLevel: "low",
    useGoogleSearch: true,
  });

  assert.deepEqual(config.tools, [{ googleSearch: {} }]);
  assert.equal(config.maxOutputTokens, 16000);
  assert.deepEqual(config.thinkingConfig, { thinkingLevel: "low" });
});

test("Gemini config omits tools when search grounding is disabled", () => {
  const config = buildGeminiGenerateConfig({
    useGoogleSearch: false,
  });

  assert.equal(Object.hasOwn(config, "tools"), false);
});

test("Gemini config preserves JSON response mime type with grounding", () => {
  const config = buildGeminiGenerateConfig({
    responseMimeType: "application/json",
    useGoogleSearch: true,
  });

  assert.equal(config.responseMimeType, "application/json");
  assert.deepEqual(config.tools, [{ googleSearch: {} }]);
});

test("Gemini section prompt bans generated graphs by default", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "Container Basics",
    bookTitle: "Docker Guide",
  });

  assert.match(prompt, /Do not include charts, graphs, diagrams/);
  assert.match(prompt, /Code blocks are only for real source code/);
});

test("Gemini section prompt allows text graphics when requested", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "Container Basics",
    bookTitle: "Docker Guide",
    includeTextGraphics: true,
  });

  assert.match(prompt, /reader-friendly visual explainers/);
  assert.match(prompt, /Markdown tables/);
  assert.doesNotMatch(prompt, /Do not include charts, graphs, diagrams/);
});
