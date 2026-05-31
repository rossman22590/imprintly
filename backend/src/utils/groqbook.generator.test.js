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

test("Groq section prompt makes children's books page-based", () => {
  const messages = buildGroqSectionMessages({
    chapterTitle: "The Puddle Parade",
    bookTitle: "Mira's Rainy Day",
    genre: "Children's Book",
  });
  const prompt = messages.map((message) => message.content).join("\n\n");

  assert.match(prompt, /children's picture book writer/);
  assert.match(prompt, /two-page scene for individual PDF pages/);
  assert.match(prompt, /children's-book story text/);
  assert.match(prompt, /short story line under the image/);
  assert.match(prompt, /illustration page/);
  assert.match(prompt, /Story page text amount/);
  assert.doesNotMatch(prompt, /long, comprehensive, polished chapter/);
});

test("Groq section prompt makes textbooks use textbook formatting", () => {
  const messages = buildGroqSectionMessages({
    chapterTitle: "Cellular Respiration",
    bookTitle: "Biology Foundations",
    genre: "Textbook",
  });
  const prompt = messages.map((message) => message.content).join("\n\n");

  assert.match(prompt, /expert textbook author/);
  assert.match(prompt, /formal, pedagogically sequenced textbook chapter/);
  assert.match(prompt, /Learning Objectives/);
  assert.match(prompt, /Key Terms/);
  assert.match(prompt, /Review Questions/);
  assert.match(prompt, /Do not use workbook fill-in blanks/);
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

test("Groq children's outlines use spread titles instead of chapter fallbacks", () => {
  const outline = normalizeOutlineJson(
    {
      title: "Mira's Rainy Day",
      structure: {
        "Spread 1: The First Puddle": "Mira spots a shiny puddle.",
        "Page 3-4: Umbrella Parade": "The friends march in the rain.",
        "Chapter 3: Rainbow Boots": "Mira finds courage.",
      },
    },
    { genre: "Children's Book" }
  );

  assert.deepEqual(
    outline.chapters.map((chapter) => chapter.title),
    ["The First Puddle", "Umbrella Parade", "Rainbow Boots"]
  );
});
