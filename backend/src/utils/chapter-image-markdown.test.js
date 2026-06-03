const assert = require("node:assert/strict");
const test = require("node:test");
const {
  filterChapterImagesToContent,
  normalizeChapterImages,
} = require("./chapter-image-markdown");

test("filters generated chapter images that were removed from markdown content", () => {
  const content =
    "Intro\n\n![Keep](https://api.example.com/uploads/keep.png)\n\nOutro";
  const images = [
    { url: "/uploads/keep.png", alt: "Keep" },
    { url: "/uploads/remove.png", alt: "Remove" },
  ];

  assert.deepEqual(filterChapterImagesToContent(content, images), [
    { url: "/uploads/keep.png", alt: "Keep" },
  ]);
});

test("matches stored image assets against markdown URLs by path", () => {
  const content =
    "![Art](https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/art.png)";
  const images = [
    {
      url: "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/art.png",
      alt: "Art",
    },
  ];

  assert.deepEqual(filterChapterImagesToContent(content, images), [
    {
      url: "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/art.png",
      alt: "Art",
    },
  ]);
});

test("keeps existing normalization behavior available for repair paths", () => {
  const images = [
    { url: "/uploads/one.png", alt: "One" },
    { url: "/uploads/one.png", alt: "Duplicate" },
  ];

  assert.deepEqual(normalizeChapterImages(images), [
    { url: "/uploads/one.png", alt: "One" },
  ]);
});
