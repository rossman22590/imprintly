const assert = require("node:assert/strict");
const test = require("node:test");
const ENV = require("../configs/env");
const {
  shouldRetryUploadError,
  uploadImageBufferToStorage,
} = require("./image-storage");

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_UPLOAD_URL = ENV.IMAGE_UPLOAD_API_URL;
const ORIGINAL_TRUSTED_HOSTS = ENV.TRUSTED_IMAGE_HOSTS;

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  ENV.IMAGE_UPLOAD_API_URL = ORIGINAL_UPLOAD_URL;
  ENV.TRUSTED_IMAGE_HOSTS = ORIGINAL_TRUSTED_HOSTS;
});

test("retries temporary image upload failures before returning the public URL", async () => {
  ENV.IMAGE_UPLOAD_API_URL = "https://upload.example.test/api/upload";
  ENV.TRUSTED_IMAGE_HOSTS = "pixiomedia.nyc3.digitaloceanspaces.com";
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    if (calls < 3) {
      return {
        ok: false,
        status: 500,
        text: async () => '{"error":"Upload failed"}',
      };
    }

    return {
      ok: true,
      json: async () => ({
        publicURL:
          "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/retry.jpg",
      }),
    };
  };

  const url = await uploadImageBufferToStorage({
    buffer: Buffer.from("image"),
    fileName: "retry.jpg",
    mimeType: "image/jpeg",
    maxAttempts: 3,
    retryDelayMs: 0,
  });

  assert.equal(calls, 3);
  assert.equal(
    url,
    "https://pixiomedia.nyc3.digitaloceanspaces.com/uploads/retry.jpg"
  );
});

test("does not retry non-temporary image upload errors", async () => {
  ENV.IMAGE_UPLOAD_API_URL = "https://upload.example.test/api/upload";
  ENV.TRUSTED_IMAGE_HOSTS = "pixiomedia.nyc3.digitaloceanspaces.com";
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    return {
      ok: false,
      status: 400,
      text: async () => '{"error":"Bad request"}',
    };
  };

  await assert.rejects(
    () =>
      uploadImageBufferToStorage({
        buffer: Buffer.from("image"),
        fileName: "bad.jpg",
        mimeType: "image/jpeg",
        maxAttempts: 3,
        retryDelayMs: 0,
      }),
    /Image upload failed with 400/
  );

  assert.equal(calls, 1);
});

test("classifies retryable image upload errors", () => {
  assert.equal(shouldRetryUploadError({ statusCode: 500 }), true);
  assert.equal(shouldRetryUploadError({ statusCode: 502 }), true);
  assert.equal(shouldRetryUploadError({ statusCode: 429 }), true);
  assert.equal(shouldRetryUploadError({ statusCode: 400 }), false);
});
