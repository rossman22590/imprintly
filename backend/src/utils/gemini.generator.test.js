const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildGeminiGenerateConfig,
  buildGeminiSectionPrompt,
  normalizeOutlineJson,
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

  assert.match(prompt, /Graphics mode is disabled/);
  assert.match(prompt, /Do not include charts, graphs, diagrams/);
  assert.match(prompt, /Mermaid/);
  assert.match(prompt, /Code blocks are only for real source code/);
});

test("Gemini section prompt allows text graphics when requested", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "Container Basics",
    bookTitle: "Docker Guide",
    includeTextGraphics: true,
  });

  assert.match(prompt, /Graphics mode is enabled/);
  assert.match(prompt, /reader-friendly text graphics/);
  assert.match(prompt, /Markdown tables/);
  assert.match(prompt, /only when the chapter brief or user request clearly asks/);
  assert.doesNotMatch(prompt, /Do not include charts, graphs, diagrams/);
});

test("Gemini section prompt applies large chapter length instructions", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "Container Basics",
    bookTitle: "Docker Guide",
    chapterLength: "large",
  });

  assert.match(prompt, /Chapter length: Large/);
  assert.match(prompt, /3,500-5,000 words/);
  assert.match(prompt, /about 14-20 ebook pages/);
  assert.match(prompt, /hyper-detailed/);
});

test("Gemini section prompt includes book bible canon instructions", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "The Hidden Gate",
    bookTitle: "Moonforge",
    bookBible: "Characters: Mira has green eyes.\nWorld Rules: Magic cannot revive the dead.",
  });

  assert.match(prompt, /Book Bible \/ source of truth/);
  assert.match(prompt, /Mira has green eyes/);
  assert.match(prompt, /Treat the Book Bible as canon/);
  assert.match(prompt, /Do not contradict it/);
});

test("Gemini section prompt makes novel chapters narrative", () => {
  const prompt = buildGeminiSectionPrompt({
    chapterTitle: "The Locked Observatory",
    bookTitle: "Moonforge",
    genre: "Novel",
  });

  assert.match(prompt, /Write this as real novel prose/);
  assert.match(prompt, /immersive scene work/);
  assert.match(prompt, /publication-quality novel chapter/);
  assert.match(prompt, /character objective, obstacle, conflict/);
  assert.match(prompt, /Avoid instructional headings/);
  assert.doesNotMatch(prompt, /practical examples/);
  assert.doesNotMatch(prompt, /reader takeaways/);
});

test("novel outlines strip textbook numbering from chapter titles", () => {
  const outline = normalizeOutlineJson(
    {
      title: "Moonforge",
      subtitle: "A Starship Novel",
      structure: {
        "1. The Signal Beneath the Ice": "Mira hears the impossible signal.",
        "1.2 The Door That Should Not Open": "Ross finds the sealed chamber.",
        "Module 3: The False Dawn": "Nick decodes the first warning.",
      },
    },
    { genre: "Novel" }
  );

  assert.deepEqual(
    outline.chapters.map((chapter) => chapter.title),
    [
      "The Signal Beneath the Ice",
      "The Door That Should Not Open",
      "The False Dawn",
    ]
  );
  assert.deepEqual(outline.chapters[1].outlinePath, [
    "The Door That Should Not Open",
  ]);
});
