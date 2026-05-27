const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeBookBiblePayload,
  serializeBookBible,
} = require("./book-bible");

test("normalizes Book Bible payload to supported fields only", () => {
  const bible = normalizeBookBiblePayload({
    characters: "Mira: green eyes",
    canonFacts: "<b>Magic cannot revive the dead.</b>",
    ignored: "drop me",
  });

  assert.equal(bible.characters, "Mira: green eyes");
  assert.equal(bible.canonFacts, "Magic cannot revive the dead.");
  assert.equal(Object.hasOwn(bible, "ignored"), false);
  assert.equal(bible.locations, "");
});

test("normalizes array and object bible values into markdown bullets", () => {
  const bible = normalizeBookBiblePayload({
    characters: [
      "Mira: green eyes",
      { Jonas: "ship mechanic" },
      "- Existing bullet",
    ],
  });

  assert.equal(
    bible.characters,
    "- Mira: green eyes\n- **Jonas**: ship mechanic\n- Existing bullet"
  );
});

test("serializes Book Bible as prompt-ready canon sections", () => {
  const promptText = serializeBookBible({
    characters: "Mira: green eyes",
    worldRules: "Magic cannot revive the dead.",
  });

  assert.match(promptText, /## Characters/);
  assert.match(promptText, /Mira: green eyes/);
  assert.match(promptText, /## World Rules/);
  assert.match(promptText, /Magic cannot revive the dead/);
});
