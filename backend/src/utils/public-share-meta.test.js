const assert = require("node:assert/strict");
const test = require("node:test");
const Book = require("../models/Book");
const User = require("../models/User");
const { getPublicShareMetaForPath } = require("./public-share-meta");

test("public shelf meta only looks up active owners", async (t) => {
  let seenQuery = null;

  t.mock.method(User, "findOne", (query) => {
    seenQuery = query;
    return {
      lean: async () => null,
    };
  });

  const meta = await getPublicShareMetaForPath("/shelf/shelf_123");

  assert.equal(meta, null);
  assert.equal(seenQuery["bookshelfShare.token"], "shelf_123");
  assert.deepEqual(seenQuery.$or, [
    { status: "active" },
    { status: { $exists: false } },
  ]);
});

test("public preview meta hides books owned by banned users", async (t) => {
  let populateSelect = "";

  t.mock.method(Book, "findOne", () => ({
    populate(options) {
      populateSelect = options.select;
      return {
        lean: async () => ({
          title: "Hidden Book",
          userId: {
            name: "Hidden Author",
            status: "banned",
          },
        }),
      };
    },
  }));

  const meta = await getPublicShareMetaForPath("/preview/preview_123");

  assert.equal(meta, null);
  assert.match(populateSelect, /\bstatus\b/);
});
