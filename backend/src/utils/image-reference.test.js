const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getChapterReferenceImageUrls,
  getContinuityImageUrls,
  getCoverReferenceImageUrls,
  getPriorChapterImageUrls,
} = require("./image-reference");

test("uses first and latest prior chapter image URLs as continuity references", () => {
  const urls = getPriorChapterImageUrls(
    {
      chapters: [
        {
          images: [{ url: "https://example.com/chapter-1.png", source: "gemini" }],
        },
        {
          images: [{ url: "https://example.com/chapter-2.png", source: "gemini" }],
        },
        {
          images: [{ url: "https://example.com/chapter-3.png", source: "gemini" }],
        },
      ],
    },
    3
  );

  assert.deepEqual(urls, [
    "https://example.com/chapter-1.png",
    "https://example.com/chapter-3.png",
  ]);
});

test("dedupes continuity references when only one prior image exists", () => {
  const urls = getPriorChapterImageUrls(
    {
      chapters: [
        {
          images: [{ url: "https://example.com/chapter-1.png", source: "gemini" }],
        },
      ],
    },
    1
  );

  assert.deepEqual(urls, ["https://example.com/chapter-1.png"]);
});

test("uses first and latest images generated in the current run as continuity fallback", () => {
  const urls = getContinuityImageUrls([
    "https://example.com/current-run-1.png",
    "https://example.com/current-run-2.png",
    "https://example.com/current-run-3.png",
  ]);

  assert.deepEqual(urls, [
    "https://example.com/current-run-1.png",
    "https://example.com/current-run-3.png",
  ]);
});

test("full-book image generation prefers Visual Bible refs before generated continuity", () => {
  const book = {
    visualBible: {
      characters: [
        {
          id: "mira",
          name: "Mira",
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg",
        },
      ],
    },
    chapters: [{ title: "Mira opens the gate" }, { title: "Aftermath" }],
  };

  assert.deepEqual(
    getChapterReferenceImageUrls(book, 1, {
      generatedImageUrls: ["https://example.com/current-run-1.png"],
      visualBibleFirstFallback: true,
    }),
    ["https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg"]
  );
});

test("full-book image generation falls back to current-run images when Visual Bible has no image refs", () => {
  const book = {
    visualBible: {
      characters: [{ id: "mira", name: "Mira", description: "Pilot" }],
      styleReferences: [],
      worldReferences: [],
    },
    chapters: [{ title: "Opening" }, { title: "Second chapter" }],
  };

  assert.deepEqual(
    getChapterReferenceImageUrls(book, 1, {
      generatedImageUrls: [
        "https://example.com/current-run-1.png",
        "https://example.com/current-run-2.png",
      ],
      visualBibleFirstFallback: true,
    }),
    [
      "https://example.com/current-run-1.png",
      "https://example.com/current-run-2.png",
    ]
  );
});

test("full-book image fallback does not reuse old chapter art before current-run art exists", () => {
  const book = {
    visualBible: {},
    chapters: [
      {
        title: "Old opening",
        images: [{ url: "https://example.com/old-chapter-1.png" }],
      },
      { title: "New second chapter" },
    ],
  };

  assert.deepEqual(
    getChapterReferenceImageUrls(book, 1, {
      generatedImageUrls: [],
      visualBibleFirstFallback: true,
    }),
    []
  );
});

test("cover references include supplied visual bible images", () => {
  const book = {
    visualBible: {
      characters: [
        {
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg",
        },
      ],
      styleReferences: [
        {
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/style.jpg",
        },
      ],
      worldReferences: [
        {
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/world.jpg",
        },
      ],
    },
  };

  assert.deepEqual(getCoverReferenceImageUrls(book), [
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg",
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/style.jpg",
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/world.jpg",
  ]);
});

test("first chapter references include supplied visual bible images before prior art exists", () => {
  const book = {
    visualBible: {
      characters: [
        {
          id: "mira",
          name: "Mira",
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg",
        },
        {
          id: "ross",
          name: "Ross",
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/ross.jpg",
        },
      ],
      styleReferences: [
        {
          id: "style",
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/style.jpg",
        },
      ],
    },
    chapters: [
      {
        title: "Opening Scene",
        content: "The first image should still use supplied cast refs.",
      },
    ],
  };

  assert.deepEqual(getChapterReferenceImageUrls(book, 0), [
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg",
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/ross.jpg",
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/style.jpg",
  ]);
});
