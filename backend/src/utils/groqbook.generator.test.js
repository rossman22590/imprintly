const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildGroqSectionMessages,
  getGroqModels,
  normalizeOutlineJson,
} = require("./groqbook.generator");

test("Groq defaults chapter writing to the strongest selectable model", () => {
  assert.equal(getGroqModels({}).sectionModel, "openai/gpt-oss-120b");
});

test("Groq section prompt makes Novel chapters narrative", () => {
  const messages = buildGroqSectionMessages({
    chapterTitle: "The Locked Observatory",
    bookTitle: "Moonforge",
    genre: "Novel",
  });
  const prompt = messages.map((message) => message.content).join("\n\n");

  assert.match(prompt, /expert novelist/);
  assert.match(prompt, /real novel chapter/);
  assert.match(prompt, /publication-quality novel chapter/);
  assert.match(prompt, /character objective, obstacle, conflict/);
  assert.match(prompt, /Do not use instructional headings/);
  assert.doesNotMatch(prompt, /reader takeaways/);
});

test("Groq prompt only allows text graphics when explicitly enabled", () => {
  const defaultPrompt = buildGroqSectionMessages({
    chapterTitle: "Scaling Operations",
    bookTitle: "Operator's Manual",
  })
    .map((message) => message.content)
    .join("\n\n");
  const graphicsPrompt = buildGroqSectionMessages({
    chapterTitle: "Scaling Operations",
    bookTitle: "Operator's Manual",
    includeTextGraphics: true,
  })
    .map((message) => message.content)
    .join("\n\n");

  assert.match(defaultPrompt, /Graphics mode is disabled/);
  assert.match(defaultPrompt, /Do not include charts, graphs, diagrams/);
  assert.match(defaultPrompt, /Mermaid/);
  assert.match(graphicsPrompt, /Graphics mode is enabled/);
  assert.match(graphicsPrompt, /only when the chapter brief or user request clearly asks/);
  assert.match(graphicsPrompt, /Do not create ASCII art/);
});

test("Groq novel outlines strip textbook numbering from chapter titles", () => {
  const outline = normalizeOutlineJson(
    {
      title: "Moonforge",
      subtitle: "A Starship Novel",
      structure: {
        "Chapter 1: The Signal Beneath the Ice": "Mira hears the impossible signal.",
        "1.2 The Door That Should Not Open": "Ross finds the sealed chamber.",
        "Section 3.1 - The False Dawn": "Nick decodes the first warning.",
      },
    },
    { genre: "noval" }
  );

  assert.deepEqual(
    outline.chapters.map((chapter) => chapter.title),
    [
      "The Signal Beneath the Ice",
      "The Door That Should Not Open",
      "The False Dawn",
    ]
  );
});
