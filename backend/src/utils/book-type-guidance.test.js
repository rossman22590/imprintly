const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getDefaultChapterImageCount,
  getBookTypeStructureCount,
  getChildrenSpreadCountFromPages,
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

test("recognizes children's book variants as page-spread books", () => {
  assert.equal(getBookTypeFamily("Childrens Picture Book"), "children");
  assert.equal(getBookTypeFamily("kids storybook"), "children");
  assert.equal(getDefaultChapterImageCount("Children's Book"), 1);
  assert.equal(getChildrenSpreadCountFromPages(20), 10);
  assert.equal(getBookTypeStructureCount("Children's Book", 20), 10);

  const outlineGuidance = getBookTypeOutlineGuidance("Picture Book");
  const chapterGuidance = getBookTypeChapterGuidance("Children's Book");
  const imageGuidance = getBookTypeImageGuidance("kids book");

  assert.match(outlineGuidance, /20 pages means 10 spreads/);
  assert.match(chapterGuidance, /one illustrated two-page spread/);
  assert.match(imageGuidance, /Preserve recurring character identity/);
  assert.match(imageGuidance, /left-page illustration/);
});

test("workbook guidance preserves fill-in and worksheet formatting", () => {
  assert.equal(getBookTypeFamily("Activity Workbook"), "learning");
  assert.equal(getBookTypeFamily("worksheet pack"), "learning");
  assert.equal(getDefaultChapterImageCount("Workbook"), 1);

  const outlineGuidance = getBookTypeOutlineGuidance("Workbook");
  const chapterGuidance = getBookTypeChapterGuidance("Study Guide");
  const imageGuidance = getBookTypeImageGuidance("Workbook");

  assert.match(outlineGuidance, /fill-in blanks/);
  assert.match(chapterGuidance, /answer lines made from underscores/);
  assert.match(imageGuidance, /fill-in prompts should live in the manuscript text/);
});

test("textbook guidance enforces textbook structure", () => {
  assert.equal(getBookTypeFamily("Textbook"), "textbook");
  assert.equal(getBookTypeFamily("college text book"), "textbook");
  assert.equal(getBookTypeStructureCount("Textbook", 12), 12);

  const outlineGuidance = getBookTypeOutlineGuidance("Textbook");
  const chapterGuidance = getBookTypeChapterGuidance("Academic Textbook");
  const imageGuidance = getBookTypeImageGuidance("Textbook");

  assert.match(outlineGuidance, /complete textbook chapters/);
  assert.match(outlineGuidance, /learning objectives, key terms/);
  assert.match(chapterGuidance, /Learning Objectives, Key Terms/);
  assert.match(chapterGuidance, /review questions/);
  assert.match(imageGuidance, /textbook publishing art/);
});
