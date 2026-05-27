const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildVisualReferencePromptContext,
  getVisualReferenceUrlsForChapter,
  normalizeVisualBiblePayload,
  serializeVisualBible,
} = require("./visual-bible");

const PIXIO_URL =
  "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/mira.jpg";
const STYLE_URL =
  "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/style.jpg";

test("normalizes visual bible references to trusted image URLs only", () => {
  const visualBible = normalizeVisualBiblePayload({
    characters: [
      {
        name: "Mira",
        description: "Captain with a silver jacket",
        imageUrl: PIXIO_URL,
      },
      {
        name: "Bad Link",
        imageUrl: "https://example.com/not-imported.jpg",
      },
    ],
  });

  assert.equal(visualBible.characters[0].imageUrl, PIXIO_URL);
  assert.equal(visualBible.characters[1].imageUrl, "");
});

test("uses supplied character references as inputs and always includes style references", () => {
  const urls = getVisualReferenceUrlsForChapter(
    {
      characters: [
        { id: "mira", name: "Mira", imageUrl: PIXIO_URL },
        {
          id: "ross",
          name: "Ross",
          imageUrl:
            "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/ross.jpg",
        },
      ],
      styleReferences: [{ id: "style", label: "Painterly", imageUrl: STYLE_URL }],
    },
    {
      title: "Mira Opens the Gate",
      content: "Mira steps into the observatory.",
    }
  );

  assert.deepEqual(urls, [
    PIXIO_URL,
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/ross.jpg",
    STYLE_URL,
  ]);
});

test("builds prompt context for selected visual references", () => {
  const context = buildVisualReferencePromptContext(
    {
      characters: [
        {
          id: "mira",
          name: "Mira",
          description: "Black bobbed hair and captain uniform",
          imageUrl: PIXIO_URL,
        },
      ],
    },
    { title: "Other chapter" },
    { selectedReferenceIds: ["mira"] }
  );

  assert.match(context, /Mira/);
  assert.match(context, /visual canon/);
});

test("serializes visual bible descriptions for chapter text prompts", () => {
  const promptText = serializeVisualBible({
    characters: [
      {
        name: "Mira",
        description: "Black bobbed hair and captain uniform",
        imageUrl: PIXIO_URL,
      },
    ],
    styleReferences: [
      {
        label: "Painterly",
        description: "Warm cinematic lighting",
      },
    ],
    worldReferences: [
      {
        name: "Artifact chamber",
        description: "Obsidian walls and violet glyphs",
      },
    ],
    notes: "Keep recurring outfits and ship interiors consistent.",
  });

  assert.match(promptText, /## Visual Characters/);
  assert.match(promptText, /Mira - Black bobbed hair and captain uniform/);
  assert.match(promptText, /\[reference image supplied\]/);
  assert.match(promptText, /Warm cinematic lighting/);
  assert.match(promptText, /Artifact chamber/);
  assert.match(promptText, /recurring outfits/);
});
