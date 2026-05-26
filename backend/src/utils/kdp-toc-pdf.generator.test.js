const test = require("node:test");
const assert = require("node:assert/strict");
const {
  __private,
  generateKdpTocPdf,
} = require("./kdp-toc-pdf.generator");

test("parses saved KDP table of contents entries", () => {
  const entries = __private.parseTocEntries({
    kdp: {
      assets: {
        tableOfContents: `
Table of Contents
1. Introduction
2. Building the System
Chapter 3: Launch Plan
`,
      },
    },
    chapters: [{ title: "Fallback" }],
  });

  assert.deepEqual(entries, [
    { number: 1, title: "Introduction" },
    { number: 2, title: "Building the System" },
    { number: 3, title: "Launch Plan" },
  ]);
});

test("normalizes unknown TOC designs to standard basic", () => {
  assert.equal(__private.normalizeTocDesign("basic"), "basic");
  assert.equal(__private.normalizeTocDesign("not-real"), "basic");
});

test("generates a KDP table of contents PDF buffer", async () => {
  const buffer = await generateKdpTocPdf({
    title: "Publishing Test",
    author: "Bookify",
    kdp: {
      settings: {
        trimSize: "6x9",
      },
      assets: {
        tableOfContents: "1. First Chapter\n2. Second Chapter",
      },
    },
    chapters: [],
  });

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});

test("generates a basic black and white TOC PDF", async () => {
  const buffer = await generateKdpTocPdf(
    {
      title: "Plain Test",
      kdp: {
        settings: {
          trimSize: "6x9",
        },
        assets: {
          tableOfContents: "1. First Chapter\n2. Second Chapter",
        },
      },
      chapters: [],
    },
    { design: "basic" }
  );

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});

test("generates every TOC design without layout errors", async () => {
  const designs = ["basic", "editorial", "classic", "modern", "luxe", "ledger"];
  const book = {
    title: "Design Stress Test",
    subtitle: "A long subtitle that should stay inside the page bounds",
    author: "Bookify",
    kdp: {
      settings: {
        trimSize: "5x8",
      },
      assets: {
        tableOfContents: [
          "1. A Very Long Opening Chapter Title That Wraps Cleanly Without Overlapping Anything",
          "2. Positioning and Publishing Strategy",
          "3. Final Upload Checklist",
        ].join("\n"),
      },
    },
    chapters: [],
  };

  for (const design of designs) {
    const buffer = await generateKdpTocPdf(book, { design });
    assert.ok(buffer.length > 1000, `${design} PDF should not be empty`);
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  }
});
