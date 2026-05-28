const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildEnhancedBookContext,
  getGraphicsPolicy,
} = require("./book-editorial.pipeline");

test("enhanced book context carries prior chapter memory forward", () => {
  const context = buildEnhancedBookContext({
    title: "Moonforge",
    genre: "Novel",
    audience: "Sci-fi readers",
    chapters: [
      { title: "Signal", description: "Mira hears the signal." },
      { title: "Door", description: "The sealed door opens." },
    ],
    completedChapters: [
      {
        title: "Signal",
        content: "Mira ends the chapter trapped under the observatory.",
        generationStats: {
          editorialMemory:
            "- Mira heard the impossible signal.\n- She is trapped under the observatory.",
        },
      },
    ],
  });

  assert.match(context, /Prior chapter memory and continuity state/);
  assert.match(context, /Mira heard the impossible signal/);
  assert.match(context, /Immediate previous chapter state/);
  assert.match(context, /The sealed door opens/);
});

test("graphics policy blocks ASCII diagrams unless graphics are enabled and explicit", () => {
  assert.match(getGraphicsPolicy(false), /Graphics button is disabled/);
  assert.match(getGraphicsPolicy(false), /Do not include charts, graphs, diagrams/);
  assert.match(getGraphicsPolicy(false), /Mermaid/);
  assert.match(getGraphicsPolicy(true), /Graphics button is enabled/);
  assert.match(
    getGraphicsPolicy(true),
    /unless the chapter brief explicitly asks for an ASCII diagram/
  );
});
