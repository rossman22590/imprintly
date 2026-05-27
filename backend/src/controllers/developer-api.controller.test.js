const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildBookDownloadLinks,
  serializeV1Book,
  serializeV1GenerationJob,
} = require("./developer-api.controller");

test("serializes developer API generation jobs without user IDs", () => {
  const createdAt = new Date("2026-01-02T00:00:00.000Z");
  const serialized = serializeV1GenerationJob({
    id: "job_123",
    userId: "user_123",
    bookId: "book_123",
    provider: "groq",
    status: "queued",
    progress: { total: 0, completed: 0 },
    failedChapters: [],
    error: "",
    createdAt,
  });

  assert.equal(serialized.object, "generation_job");
  assert.equal(serialized.id, "job_123");
  assert.equal(serialized.bookId, "book_123");
  assert.equal(serialized.status, "queued");
  assert.equal(Object.hasOwn(serialized, "userId"), false);
});

test("builds absolute PDF and EPUB download links for retrieved books", () => {
  const req = {
    protocol: "https",
    get(name) {
      return {
        host: "api.example.com",
      }[name.toLowerCase()];
    },
  };
  const links = buildBookDownloadLinks(req, "book_123");

  assert.equal(links.pdf.url, "https://api.example.com/api/v1/books/book_123/pdf");
  assert.equal(links.pdf.contentType, "application/pdf");
  assert.equal(links.epub.url, "https://api.example.com/api/v1/books/book_123/epub");
  assert.equal(links.epub.contentType, "application/epub+zip");
});

test("serializes retrieved books with download links", () => {
  const req = {
    protocol: "https",
    get(name) {
      return {
        host: "api.example.com",
      }[name.toLowerCase()];
    },
  };
  const book = {
    _id: { toString: () => "book_123" },
    title: "Generated Book",
    generation: { status: "complete" },
  };
  const serialized = serializeV1Book(req, book);

  assert.equal(serialized.object, "book");
  assert.equal(serialized.id, "book_123");
  assert.equal(serialized.status, "complete");
  assert.equal(serialized.downloads.pdf.method, "GET");
  assert.equal(serialized.downloads.epub.method, "GET");
});
