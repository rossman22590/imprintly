const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractChildrenSpreadParts,
  extractChildrenSpreadStoryText,
  sanitizeChildrenSpreadManuscript,
} = require("./children-spread-content");

test("extracts only right-page story text from labeled children spread output", () => {
  const content = [
    "### Left Page: Illustration",
    "",
    "![The Grand Map of Mud illustration](https://example.com/image.jpg)",
    "",
    "Under the sweeping green canopy, three friends huddle with a map.",
    "",
    "***",
    "",
    "### Right Page: Story Text",
    "",
    "\"Ta-da!\" squeaked Pip.",
    "",
    "***Squish! Squash! Squelch!***",
  ].join("\n");

  const storyText = extractChildrenSpreadStoryText(content);

  assert.doesNotMatch(storyText, /Left Page/);
  assert.doesNotMatch(storyText, /sweeping green canopy/);
  assert.doesNotMatch(storyText, /example\.com/);
  assert.match(storyText, /"Ta-da!" squeaked Pip/);
  assert.match(storyText, /\*\*\*Squish! Squash! Squelch!\*\*\*/);
});

test("keeps short left-page story text but drops long illustration directions", () => {
  const parts = extractChildrenSpreadParts(
    [
      "### Left Page: Illustration",
      "",
      "Mud went squish under Pippa's shiny boots.",
      "",
      "***",
      "",
      "### Right Page: Story Text",
      "",
      "Pip waved the map and marched ahead.",
    ].join("\n")
  );

  assert.equal(parts.leftText, "Mud went squish under Pippa's shiny boots.");
  assert.match(parts.rightText, /Pip waved/);

  const sanitized = sanitizeChildrenSpreadManuscript(
    [
      "### Left Page: Illustration",
      "",
      "Under the sweeping green canopy of a giant, ancient oak tree, three best friends huddle together on the mossy forest floor while Pip holds up a floppy sycamore leaf map and Barnaby squints down at it in confusion as Pippa adjusts her shiny red boots under dappled sunlight.",
      "",
      "***",
      "",
      "### Right Page: Story Text",
      "",
      "\"Ta-da!\" squeaked Pip.",
    ].join("\n")
  );

  assert.doesNotMatch(sanitized, /sweeping green canopy/);
  assert.match(sanitized, /"Ta-da!" squeaked Pip/);
});

test("sanitizes child spread manuscript without removing unlabeled story text", () => {
  const content = [
    "Mira tugged her red boots.",
    "",
    "The puddle winked.",
  ].join("\n");

  assert.equal(sanitizeChildrenSpreadManuscript(content), content);
});
