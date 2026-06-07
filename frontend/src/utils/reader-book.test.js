import test from "node:test";
import assert from "node:assert/strict";
import {
  filterLibraryBooks,
  isSourceDocumentOnlyBook,
  normalizeBookForReader,
} from "./reader-book.js";

test("isSourceDocumentOnlyBook hides books with source files but no chapter content", () => {
  assert.equal(
    isSourceDocumentOnlyBook({
      sourceFiles: [{ name: "notes.pdf", url: "/uploads/notes.pdf" }],
      chapters: [],
    }),
    true
  );

  assert.equal(
    isSourceDocumentOnlyBook({
      sourceFiles: [{ name: "notes.pdf", url: "/uploads/notes.pdf" }],
      chapters: [{ title: "Chapter 1", content: "Once upon a time..." }],
    }),
    false
  );

  assert.equal(
    isSourceDocumentOnlyBook({
      sourceFiles: [],
      chapters: [],
    }),
    false
  );
});

test("filterLibraryBooks removes source-only uploads from the library", () => {
  const books = [
    { _id: "1", title: "Real Book", chapters: [{ content: "Hello" }] },
    {
      _id: "2",
      title: "Source PDF Smoke",
      sourceFiles: [{ name: "smoke.pdf" }],
      chapters: [],
    },
  ];

  const visible = filterLibraryBooks(books);

  assert.equal(visible.length, 1);
  assert.equal(visible[0]._id, "1");
});

test("normalizeBookForReader strips source file metadata", () => {
  const readerBook = normalizeBookForReader({
    title: "Real Book",
    sourceFiles: [{ name: "notes.pdf" }],
    chapters: [{ title: "Chapter 1", content: "Hello" }],
  });

  assert.deepEqual(readerBook.sourceFiles, []);
  assert.equal(readerBook.chapters.length, 1);
});
