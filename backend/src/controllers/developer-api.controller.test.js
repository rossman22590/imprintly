const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildBookDownloadLinks,
  serializePublicBook,
  serializeV1Book,
  serializeV1BookSummary,
  serializeV1Credits,
  serializeV1GenerationJob,
  serializeV1List,
  uploadSourceFilesV1,
} = require("./developer-api.controller");
const { mapSourceUploadError } = require("../middlewares/upload.middleware");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

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

test("serializes developer API credit balances with credits left", () => {
  const serialized = serializeV1Credits({
    credits: {
      balance: 42.5,
      lifetimeGranted: 100,
      lifetimeSpent: 57.5,
      monthlyAllowance: 750,
      monthlyPreset: "premium",
      monthlyResetAt: new Date("2026-05-01T00:00:00.000Z"),
      nextMonthlyResetAt: "2026-06-01T00:00:00.000Z",
    },
    transactions: [{ id: "hidden" }],
  });

  assert.equal(serialized.object, "credits");
  assert.equal(serialized.creditsLeft, 42.5);
  assert.equal(serialized.credits.balance, 42.5);
  assert.equal(serialized.credits.monthlyPreset, "premium");
  assert.equal(Object.hasOwn(serialized, "transactions"), false);
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
    userId: "user_123",
    title: "Generated Book",
    author: "Ross",
    previewShare: { token: "secret" },
    generation: { status: "complete" },
  };
  const serialized = serializeV1Book(req, book);

  assert.equal(serialized.object, "book");
  assert.equal(serialized.id, "book_123");
  assert.equal(serialized.status, "complete");
  assert.equal(serialized.book.id, "book_123");
  assert.equal(serialized.book.title, "Generated Book");
  assert.equal(Object.hasOwn(serialized.book, "userId"), false);
  assert.equal(Object.hasOwn(serialized.book, "previewShare"), false);
  assert.equal(serialized.downloads.pdf.method, "GET");
  assert.equal(serialized.downloads.epub.method, "GET");
});

test("serializes book summaries without chapter content or ownership data", () => {
  const req = {
    protocol: "https",
    get(name) {
      return {
        host: "api.example.com",
      }[name.toLowerCase()];
    },
  };
  const serialized = serializeV1BookSummary(req, {
    _id: { toString: () => "book_123" },
    userId: "user_123",
    title: "Generated Book",
    author: "Ross",
    status: "draft",
    generation: { status: "complete" },
    chapters: [{ _id: "chapter_1" }, { _id: "chapter_2" }],
  });

  assert.equal(serialized.object, "book_summary");
  assert.equal(serialized.id, "book_123");
  assert.equal(serialized.status, "complete");
  assert.equal(serialized.bookStatus, "draft");
  assert.equal(serialized.chapterCount, 2);
  assert.equal(Object.hasOwn(serialized, "chapters"), false);
  assert.equal(Object.hasOwn(serialized, "userId"), false);
  assert.equal(
    serialized.downloads.pdf.url,
    "https://api.example.com/api/v1/books/book_123/pdf"
  );
});

test("serializes book summaries for manual books without generation state", () => {
  const serialized = serializeV1BookSummary(
    { protocol: "https", get: () => "" },
    {
      _id: { toString: () => "book_456" },
      title: "Manual Book",
    }
  );

  assert.equal(serialized.status, "manual");
  assert.equal(serialized.bookStatus, "draft");
  assert.equal(serialized.chapterCount, 0);
});

test("serializes lists with pagination metadata", () => {
  const full = serializeV1List([{ id: "a" }, { id: "b" }], {
    limit: 2,
    offset: 0,
  });

  assert.equal(full.object, "list");
  assert.equal(full.count, 2);
  assert.equal(full.limit, 2);
  assert.equal(full.offset, 0);
  assert.equal(full.hasMore, true);

  const partial = serializeV1List([{ id: "a" }], { limit: 2, offset: 2 });

  assert.equal(partial.count, 1);
  assert.equal(partial.hasMore, false);

  const exactLastPage = serializeV1List([{ id: "a" }, { id: "b" }], {
    limit: 2,
    offset: 4,
    hasMore: false,
  });

  assert.equal(exactLastPage.count, 2);
  assert.equal(exactLastPage.hasMore, false);
});

test("serializes public book fields without internal ownership data", () => {
  const serialized = serializePublicBook({
    _id: { toString: () => "book_123" },
    userId: "user_123",
    __v: 1,
    title: "Generated Book",
    subtitle: "A Guide",
    author: "Ross",
    genre: "Nonfiction",
    audience: "Founders",
    language: "English",
    chapters: [
      {
        _id: { toString: () => "chapter_1" },
        title: "Intro",
        content: "Hello",
        images: [{ _id: { toString: () => "image_1" }, url: "/uploads/a.png" }],
      },
    ],
    generation: { status: "complete" },
  });

  assert.equal(serialized.id, "book_123");
  assert.equal(serialized.chapters[0].id, "chapter_1");
  assert.equal(serialized.chapters[0].images[0].id, "image_1");
  assert.equal(Object.hasOwn(serialized, "userId"), false);
  assert.equal(Object.hasOwn(serialized, "__v"), false);
});

test("rejects source-file uploads with no files", async () => {
  const res = mockRes();

  await uploadSourceFilesV1({ files: [] }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /No source files/);
});

test("builds source-file records from uploaded documents", async () => {
  const tmpPath = path.join(
    os.tmpdir(),
    `bookify-src-test-${process.pid}.txt`
  );
  fs.writeFileSync(tmpPath, "Field notes: the tide came in at dawn.", "utf8");

  try {
    const res = mockRes();
    await uploadSourceFilesV1(
      {
        files: [
          {
            path: tmpPath,
            originalname: "notes.txt",
            filename: path.basename(tmpPath),
            mimetype: "text/plain",
            size: fs.statSync(tmpPath).size,
          },
        ],
      },
      res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.object, "source_files");
    assert.equal(res.body.sourceFiles.length, 1);

    const record = res.body.sourceFiles[0];
    assert.equal(record.name, "notes.txt");
    assert.equal(record.mimeType, "text/plain");
    assert.match(record.url, /^\/uploads\//);
    assert.match(record.extractedText, /tide came in at dawn/);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test("maps source upload errors to clear messages", () => {
  const sizeErr = Object.assign(new Error("File too large"), {
    name: "MulterError",
    code: "LIMIT_FILE_SIZE",
  });
  Object.setPrototypeOf(sizeErr, require("multer").MulterError.prototype);

  assert.match(mapSourceUploadError(sizeErr), /12MB or smaller/);

  const countErr = Object.assign(new Error("Too many"), {
    code: "LIMIT_FILE_COUNT",
  });
  Object.setPrototypeOf(countErr, require("multer").MulterError.prototype);

  assert.match(mapSourceUploadError(countErr), /at most 6 source files/);

  const filterErr = new Error("Only PDF, DOCX, ... are allowed.");
  assert.equal(mapSourceUploadError(filterErr), "Only PDF, DOCX, ... are allowed.");
});
