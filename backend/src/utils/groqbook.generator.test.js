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

test("Groq prompt makes children books two individual pages", () => {
  const prompt = buildGroqSectionMessages({
    chapterTitle: "The Door Under the Bed",
    bookTitle: "Barnaby and the Under-Bed Express",
    genre: "Children's Book",
    chapterLength: "medium",
  })
    .map((message) => message.content)
    .join("\n\n");

  assert.match(prompt, /children's picture book writer/);
  assert.match(prompt, /two individual children's book pages/);
  assert.match(prompt, /image on top/);
  assert.match(prompt, /45-80 words/);
  assert.match(prompt, /roughly twice as much read-aloud story copy/);
  assert.match(prompt, /Story page text amount: Medium/);
});

test("Groq prompt makes textbook chapters use textbook structure", () => {
  const prompt = buildGroqSectionMessages({
    chapterTitle: "Forces and Motion",
    bookTitle: "Physics Foundations",
    genre: "Textbook",
  })
    .map((message) => message.content)
    .join("\n\n");

  assert.match(prompt, /expert textbook author/);
  assert.match(prompt, /Learning Objectives/);
  assert.match(prompt, /Key Terms/);
  assert.match(prompt, /Chapter Summary/);
  assert.match(prompt, /Review Questions/);
  assert.match(prompt, /Do not use workbook fill-in blanks/);
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

test("Groq children outlines strip chapter and page labels from scene titles", () => {
  const outline = normalizeOutlineJson(
    {
      title: "Barnaby",
      structure: {
        "Scene 1 - The Glowing Sock": "Barnaby finds a tiny portal.",
        "Pages 3-4: The Under-Bed Station": "The train whistles softly.",
        "Chapter 3: Monster Tea": "Everyone shares moonberry tea.",
      },
    },
    { genre: "Children's Book" }
  );

  assert.deepEqual(
    outline.chapters.map((chapter) => chapter.title),
    ["The Glowing Sock", "The Under-Bed Station", "Monster Tea"]
  );
});
