const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const {
  buildGeminiSourceParts,
  buildSourceBibleMarkdown,
  extractTextFromSourceFile,
  normalizeSourceFilesPayload,
} = require("./book-source-documents");
const { uploadsDirPath } = require("./upload-paths");

test("normalizes source files to supported upload records", () => {
  const sourceFiles = normalizeSourceFilesPayload([
    {
      id: "source-1",
      name: "My Notes.md",
      url: "/uploads/source-notes.md",
      mimeType: "text/markdown",
      size: 120,
      extractedText: "# Notes\nA moonlit city.",
    },
    {
      name: "bad.exe",
      url: "/uploads/bad.exe",
      mimeType: "application/x-msdownload",
    },
  ]);

  assert.equal(sourceFiles.length, 1);
  assert.equal(sourceFiles[0].name, "My Notes.md");
  assert.equal(sourceFiles[0].textPreview, "# Notes\nA moonlit city.");
});

test("extracts text from markdown source files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "imprintly-source-"));
  const filePath = path.join(dir, "draft.md");

  fs.writeFileSync(filePath, "# Draft\n\nA small source-backed chapter.", "utf8");

  const text = await extractTextFromSourceFile({
    path: filePath,
    name: "draft.md",
    mimeType: "text/markdown",
  });

  assert.match(text, /source-backed chapter/);
});

test("builds source bible markdown with input and file inventory", () => {
  const source = buildSourceBibleMarkdown({
    topic: "Moon Bakery",
    description: "Use the supplied recipe notes.",
    genre: "Children's Book",
    audience: "Ages 4-7",
    sourceFiles: [
      {
        id: "source-1",
        name: "recipe-notes.pdf",
        url: "/uploads/recipe-notes.pdf",
        mimeType: "application/pdf",
        size: 2048,
      },
    ],
  });

  assert.match(source, /Book input/);
  assert.match(source, /Moon Bakery/);
  assert.match(source, /recipe-notes\.pdf/);
});

test("builds Gemini parts with saved PDF inline data", async () => {
  fs.mkdirSync(uploadsDirPath, { recursive: true });
  const fileName = `source-test-${Date.now()}.pdf`;
  const filePath = path.join(uploadsDirPath, fileName);

  fs.writeFileSync(
    filePath,
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
  );

  try {
    const parts = await buildGeminiSourceParts([
      {
        id: "source-pdf",
        name: "Tiny.pdf",
        url: `/uploads/${fileName}`,
        mimeType: "application/pdf",
        size: fs.statSync(filePath).size,
      },
    ]);

    assert.equal(parts.length, 2);
    assert.match(parts[0].text, /Author-provided source documents/);
    assert.equal(parts[1].inlineData.mimeType, "application/pdf");
    assert.ok(parts[1].inlineData.data.length > 0);
  } finally {
    fs.unlinkSync(filePath);
  }
});
