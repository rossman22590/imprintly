const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getBookTypeChapterGuidance,
  getBookTypeFamily,
  getBookTypeImageGuidance,
  getBookTypeOutlineGuidance,
} = require("./book-type-guidance");

test("recognizes novel and genre fiction book types", () => {
  assert.equal(getBookTypeFamily("Novel"), "fiction");
  assert.equal(getBookTypeFamily("Noval"), "fiction");
  assert.equal(getBookTypeFamily("noval"), "fiction");
  assert.equal(getBookTypeFamily("NOVAL"), "fiction");
  assert.equal(getBookTypeFamily("noval style"), "fiction");
  assert.equal(getBookTypeFamily("Fantasy"), "fiction");
  assert.equal(getBookTypeFamily("Sci-Fi"), "fiction");
  assert.equal(getBookTypeFamily("YA Novel"), "fiction");
  assert.equal(getBookTypeFamily("Romance"), "fiction");
  assert.equal(getBookTypeFamily("Mystery Thriller"), "fiction");
});

test("novel guidance forces story structure instead of guide structure", () => {
  const outlineGuidance = getBookTypeOutlineGuidance("Noval");
  const chapterGuidance = getBookTypeChapterGuidance("Noval");

  assert.match(outlineGuidance, /Treat this as a real novel/);
  assert.match(outlineGuidance, /story-driven chapters/);
  assert.match(outlineGuidance, /Avoid chapter briefs that sound like essays/);
  assert.match(chapterGuidance, /Write this as real novel prose/);
  assert.match(chapterGuidance, /immersive scene work/);
  assert.match(chapterGuidance, /Avoid instructional headings/);
});

test("novel image guidance prevents generic instructional visuals", () => {
  const imageGuidance = getBookTypeImageGuidance("Novel");

  assert.match(imageGuidance, /narrative book art/);
  assert.match(imageGuidance, /specific story moment/);
  assert.match(imageGuidance, /not instructional graphics/);
});
