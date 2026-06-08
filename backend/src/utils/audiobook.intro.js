const crypto = require("crypto");
const Book = require("../models/Book");

function normalizeIntroVersions(intro = {}, bookAudiobook = {}) {
  const versions = Array.isArray(intro.versions) ? [...intro.versions] : [];

  if (
    intro.audioUrl &&
    !versions.some((entry) => entry.audioUrl === intro.audioUrl)
  ) {
    versions.unshift({
      id: intro.activeVersionId || crypto.randomUUID(),
      audioUrl: intro.audioUrl,
      duration: intro.duration || 0,
      charCount: intro.charCount || 0,
      voiceId: bookAudiobook.voiceId || "",
      voiceName: bookAudiobook.voiceName || "",
      modelId: bookAudiobook.modelId || "",
      createdAt: intro.updatedAt || new Date(),
    });
  }

  return versions;
}

function getIntroActiveVersion(intro = {}) {
  const versions = Array.isArray(intro.versions) ? intro.versions : [];

  if (intro.activeVersionId) {
    const selected = versions.find((entry) => entry.id === intro.activeVersionId);
    if (selected?.audioUrl) return selected;
  }

  if (versions.length > 0) {
    const latest = versions[versions.length - 1];
    if (latest?.audioUrl) return latest;
  }

  if (intro.audioUrl) {
    return {
      id: intro.activeVersionId || "legacy",
      audioUrl: intro.audioUrl,
      duration: intro.duration || 0,
      charCount: intro.charCount || 0,
      voiceId: "",
      voiceName: "",
      modelId: "",
      createdAt: intro.updatedAt || null,
    };
  }

  return null;
}

function getIntroAlbumAudio(intro = {}) {
  const active = getIntroActiveVersion(intro);
  if (!active?.audioUrl || intro.mode === "none") return null;

  return {
    title: "Introduction",
    audioUrl: active.audioUrl,
    duration: active.duration || 0,
  };
}

async function appendIntroVersion(bookId, versionData, introMeta = {}) {
  const book = await Book.findById(bookId);
  const existing = book?.audiobook?.intro || {};
  const versionId = crypto.randomUUID();
  const versions = normalizeIntroVersions(existing, book?.audiobook || {});

  versions.push({
    id: versionId,
    audioUrl: versionData.audioUrl,
    duration: versionData.duration || 0,
    charCount: versionData.charCount || 0,
    voiceId: versionData.voiceId || "",
    voiceName: versionData.voiceName || "",
    modelId: versionData.modelId || "",
    createdAt: new Date(),
  });

  const mode = introMeta.mode || existing.mode || "generated";
  const script =
    introMeta.script !== undefined ? introMeta.script : existing.script || "";

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        "audiobook.voiceId": versionData.voiceId || book?.audiobook?.voiceId || "",
        "audiobook.voiceName":
          versionData.voiceName || book?.audiobook?.voiceName || "",
        "audiobook.modelId": versionData.modelId || book?.audiobook?.modelId || "",
        "audiobook.intro.mode": mode,
        "audiobook.intro.script": script,
        "audiobook.intro.audioUrl": versionData.audioUrl,
        "audiobook.intro.duration": versionData.duration || 0,
        "audiobook.intro.charCount": versionData.charCount || 0,
        "audiobook.intro.activeVersionId": versionId,
        "audiobook.intro.versions": versions,
        "audiobook.intro.updatedAt": new Date(),
      },
    }
  );

  return versionId;
}

async function selectIntroVersion(bookId, versionId) {
  const book = await Book.findById(bookId);
  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  const intro = book.audiobook?.intro || {};
  if (intro.mode === "none") {
    const error = new Error("Intro audio not found.");
    error.statusCode = 404;
    throw error;
  }

  const versions = normalizeIntroVersions(intro, book.audiobook || {});
  const version = versions.find((entry) => entry.id === versionId);

  if (!version) {
    const error = new Error("Intro audio version not found.");
    error.statusCode = 404;
    throw error;
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        "audiobook.intro.activeVersionId": versionId,
        "audiobook.intro.audioUrl": version.audioUrl,
        "audiobook.intro.duration": version.duration || 0,
        "audiobook.intro.charCount": version.charCount || 0,
        "audiobook.intro.versions": versions,
        "audiobook.intro.updatedAt": new Date(),
      },
    }
  );

  const updatedBook = await Book.findById(bookId);
  const { calculateAudiobookTotalDuration } = require("./audiobook.chapter");
  const totalDuration = calculateAudiobookTotalDuration(updatedBook.audiobook || {});

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        "audiobook.totalDuration": totalDuration,
      },
    }
  );

  return Book.findById(bookId);
}

module.exports = {
  appendIntroVersion,
  getIntroActiveVersion,
  getIntroAlbumAudio,
  normalizeIntroVersions,
  selectIntroVersion,
};
