const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertBookReadyForApiExport,
  prepareOwnedBookForExport,
  safeExportFilename,
} = require("./book-export.service");

test("allows API export for complete or manual books", () => {
  assert.doesNotThrow(() =>
    assertBookReadyForApiExport({ generation: { status: "complete" } })
  );
  assert.doesNotThrow(() =>
    assertBookReadyForApiExport({ generation: { status: "manual" } })
  );
});

test("blocks API export while generation is incomplete", () => {
  assert.throws(
    () => assertBookReadyForApiExport({ generation: { status: "queued" } }),
    (error) =>
      error.statusCode === 409 &&
      error.message.includes("not complete yet")
  );
  assert.throws(
    () => assertBookReadyForApiExport({ generation: { status: "generating" } }),
    (error) =>
      error.statusCode === 409 &&
      error.message.includes("not complete yet")
  );
});

test("blocks API export after failed or cancelled generation", () => {
  assert.throws(
    () => assertBookReadyForApiExport({ generation: { status: "failed" } }),
    (error) =>
      error.statusCode === 409 &&
      error.message.includes("did not complete successfully")
  );
  assert.throws(
    () => assertBookReadyForApiExport({ generation: { status: "cancelled" } }),
    (error) =>
      error.statusCode === 409 &&
      error.message.includes("did not complete successfully")
  );
});

test("sanitizes export filenames", () => {
  assert.equal(safeExportFilename("My Great Book!", "pdf"), "My_Great_Book_.pdf");
});

test("rejects invalid book IDs before querying exports", async () => {
  await assert.rejects(
    () => prepareOwnedBookForExport("507f1f77bcf86cd799439011", "not-an-id"),
    (error) => error.statusCode === 400 && error.message === "Invalid book ID."
  );
});
