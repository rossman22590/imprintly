const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractChildrenSpreadParts,
  sanitizeChildrenSpreadManuscript,
} = require("./children-spread-content");

test("extracts story text from old left/right children output", () => {
  const parts = extractChildrenSpreadParts(`
### Left Page: Illustration

![A portal](https://example.com/portal.jpg)

Under the bed, Barnaby heard a tiny knock. He tucked his knees close and whispered, "Come in."

***

### Right Page: Story Text

The purple monster peeked through the silver doorway. He was big, soft, and shy.

Barnaby smiled. "Are you lost?"
`);

  assert.match(parts.leftText, /Barnaby heard a tiny knock/);
  assert.match(parts.rightText, /purple monster peeked/);
  assert.doesNotMatch(parts.leftText, /Illustration/);
  assert.doesNotMatch(parts.leftText, /https:\/\/example/);
});

test("drops illustration directions from the final child manuscript", () => {
  const sanitized = sanitizeChildrenSpreadManuscript(`
### Left Page: Illustration

Illustration prompt: Render a wide cinematic image with the monster in the foreground, soft lighting, and a portal in the background.

***

### Right Page: Story Text

Barnaby followed the glow to a room full of whispering stars. The monster held his hand so he would not be afraid.
`);

  assert.equal(
    sanitized,
    "Barnaby followed the glow to a room full of whispering stars. The monster held his hand so he would not be afraid."
  );
});
