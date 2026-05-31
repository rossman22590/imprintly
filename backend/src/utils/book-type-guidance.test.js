const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getBookTypeChapterGuidance,
  getBookTypeFamily,
  getBookTypeImageGuidance,
  getBookTypeOutlineGuidance,
  getBookTypeStructureCount,
  getChildrenSceneCountFromPages,
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

test("children book guidance treats page count as paired image and text pages", () => {
  const outlineGuidance = getBookTypeOutlineGuidance("Children's Book");
  const chapterGuidance = getBookTypeChapterGuidance("children fantasy book");
  const imageGuidance = getBookTypeImageGuidance("Picture Book");

  assert.equal(getBookTypeFamily("children fantasy book"), "children");
  assert.equal(getChildrenSceneCountFromPages(20), 10);
  assert.equal(getBookTypeStructureCount("Children's Book", 20), 10);
  assert.match(outlineGuidance, /20 pages means 10 image pages and 10 text pages/);
  assert.match(chapterGuidance, /illustration page with the image on top/);
  assert.match(chapterGuidance, /Do not make the second page a tiny blurb/);
  assert.match(imageGuidance, /story paragraph under the image/);
});

test("workbook guidance preserves printable answer spaces", () => {
  const chapterGuidance = getBookTypeChapterGuidance("Workbook");

  assert.equal(getBookTypeFamily("Workbook"), "learning");
  assert.match(chapterGuidance, /fill-in-the-blank/);
  assert.match(chapterGuidance, /answer lines/);
  assert.match(chapterGuidance, /checkboxes/);
});

test("textbook guidance uses textbook structure without workbook blanks", () => {
  const outlineGuidance = getBookTypeOutlineGuidance("Textbook");
  const chapterGuidance = getBookTypeChapterGuidance("Textbook");

  assert.equal(getBookTypeFamily("Textbook"), "textbook");
  assert.match(outlineGuidance, /formal textbook/);
  assert.match(chapterGuidance, /Learning Objectives/);
  assert.match(chapterGuidance, /Key Terms/);
  assert.match(chapterGuidance, /review questions/);
  assert.match(chapterGuidance, /Do not use workbook fill-in blanks/);
});
