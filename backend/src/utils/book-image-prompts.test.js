const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildEbookCoverEditPrompt,
  buildEbookCoverPrompt,
  getVisibleSubtitle,
} = require("./book-image-prompts");

test("cover prompts include book-type image guidance", () => {
  const prompt = buildEbookCoverPrompt({
    book: {
      title: "The Last Signal",
      subtitle: "A Novel",
      author: "A. Writer",
      genre: "Novel",
      audience: "Adult readers",
    },
  });

  assert.match(prompt, /Book type image guidance/);
  assert.match(prompt, /shelf-ready fiction cover/);
  assert.match(prompt, /Avoid generic writing/);
});

test("cover prompts make Visual Bible references mandatory canon", () => {
  const prompt = buildEbookCoverPrompt({
    book: {
      title: "The Last Signal",
      author: "A. Writer",
      genre: "Novel",
    },
  });

  assert.match(prompt, /Visual Bible references/);
  assert.match(prompt, /mandatory visual canon/);
  assert.match(prompt, /Do not ignore, contradict, or replace supplied references/);
});

test("cover prompts treat genre and audience as hidden non-rendered context", () => {
  const prompt = buildEbookCoverPrompt({
    book: {
      title: "The Last Signal",
      subtitle: "A Fantasy Novel",
      author: "A. Writer",
      genre: "Fantasy Novel",
      audience: "Adult readers",
    },
  });

  assert.doesNotMatch(prompt, /^Genre:/m);
  assert.doesNotMatch(prompt, /^Audience:/m);
  assert.match(prompt, /Allowed visible cover text/);
  assert.match(prompt, /Subtitle: none/);
  assert.match(prompt, /Do not print words like "Fantasy", "Novel", "Fantasy Novel"/);
  assert.match(prompt, /Treat all style\/category\/audience notes below as hidden creative context/);
});

test("cover edit prompts remove accidental genre labels", () => {
  const prompt = buildEbookCoverEditPrompt({
    book: {
      title: "The Last Signal",
      subtitle: "A Novel",
      author: "A. Writer",
      genre: "Novel",
      audience: "Adult readers",
    },
  });

  assert.match(prompt, /Remove any accidental genre labels/);
  assert.match(prompt, /contains only the allowed visible cover text/);
  assert.match(prompt, /Subtitle: none/);
});

test("generic genre subtitles are not rendered on covers", () => {
  assert.equal(getVisibleSubtitle("A Fantasy Novel"), "");
  assert.equal(getVisibleSubtitle("A Novel"), "");
  assert.equal(getVisibleSubtitle("A Starship Novel"), "A Starship Novel");
});
