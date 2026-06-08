const crypto = require("crypto");
const Book = require("../models/Book");

function getChapterActiveVersion(chapter = {}) {
  const versions = Array.isArray(chapter.versions) ? chapter.versions : [];

  if (chapter.activeVersionId) {
    const selected = versions.find((entry) => entry.id === chapter.activeVersionId);
    if (selected?.audioUrl) return selected;
  }

  if (versions.length > 0) {
    const latest = versions[versions.length - 1];
    if (latest?.audioUrl) return latest;
  }

  if (chapter.audioUrl) {
    return {
      id: chapter.activeVersionId || "legacy",
      audioUrl: chapter.audioUrl,
      duration: chapter.duration || 0,
      charCount: chapter.charCount || 0,
      voiceId: "",
      voiceName: "",
      modelId: "",
      createdAt: chapter.updatedAt || null,
    };
  }

  return null;
}

function getChapterAlbumAudio(chapter = {}) {
  const active = getChapterActiveVersion(chapter);
  if (!active?.audioUrl) return null;

  return {
    title: chapter.title || "",
    audioUrl: active.audioUrl,
    duration: active.duration || 0,
    chapterIndex: chapter.chapterIndex,
  };
}

function buildAlbumChapterTracks(audiobook = {}) {
  const chapters = Array.isArray(audiobook.chapters) ? audiobook.chapters : [];

  return [...chapters]
    .sort((a, b) => a.chapterIndex - b.chapterIndex)
    .map((chapter) => {
      const active = getChapterActiveVersion(chapter);
      if (!active?.audioUrl || chapter.status === "generating") return null;

      return {
        title: chapter.title || `Chapter ${chapter.chapterIndex + 1}`,
        url: active.audioUrl,
        trackIndex: chapter.chapterIndex + 1,
      };
    })
    .filter(Boolean);
}

function calculateAudiobookTotalDuration(audiobook = {}) {
  let totalDuration = 0;
  const { getIntroActiveVersion } = require("./audiobook.intro");
  const introActive = getIntroActiveVersion(audiobook.intro || {});
  if (introActive?.audioUrl) {
    totalDuration += introActive.duration || 0;
  }

  (audiobook.chapters || []).forEach((chapter) => {
    const active = getChapterActiveVersion(chapter);
    if (active?.audioUrl) {
      totalDuration += active.duration || 0;
    }
  });

  return totalDuration;
}

function normalizeChapterVersions(existing = {}, bookAudiobook = {}) {
  const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];

  if (
    existing.audioUrl &&
    !versions.some((entry) => entry.audioUrl === existing.audioUrl)
  ) {
    versions.unshift({
      id: existing.activeVersionId || crypto.randomUUID(),
      audioUrl: existing.audioUrl,
      duration: existing.duration || 0,
      charCount: existing.charCount || 0,
      voiceId: bookAudiobook.voiceId || "",
      voiceName: bookAudiobook.voiceName || "",
      modelId: bookAudiobook.modelId || "",
      createdAt: existing.updatedAt || new Date(),
    });
  }

  return versions;
}

async function setChapterGenerating(bookId, chapterIndex, title) {
  const book = await Book.findById(bookId);
  const existing = (book?.audiobook?.chapters || []).find(
    (entry) => entry.chapterIndex === chapterIndex
  );

  if (existing) {
    await Book.updateOne(
      { _id: bookId, "audiobook.chapters.chapterIndex": chapterIndex },
      {
        $set: {
          "audiobook.chapters.$.status": "generating",
          "audiobook.chapters.$.title": title,
          "audiobook.chapters.$.error": "",
          "audiobook.chapters.$.updatedAt": new Date(),
        },
      }
    );
    return;
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $push: {
        "audiobook.chapters": {
          chapterIndex,
          title,
          script: existing?.script || "",
          audioUrl: "",
          duration: 0,
          charCount: 0,
          activeVersionId: "",
          versions: [],
          status: "generating",
          error: "",
          updatedAt: new Date(),
        },
      },
    }
  );
}

async function appendChapterVersion(
  bookId,
  chapterIndex,
  title,
  versionData,
  status = "complete"
) {
  const book = await Book.findById(bookId);
  const existing = (book?.audiobook?.chapters || []).find(
    (entry) => entry.chapterIndex === chapterIndex
  );
  const versionId = crypto.randomUUID();
  const versions = normalizeChapterVersions(existing || {}, book?.audiobook || {});

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

  await Book.updateOne(
    { _id: bookId },
    {
      $pull: { "audiobook.chapters": { chapterIndex } },
    }
  );

  await Book.updateOne(
    { _id: bookId },
    {
      $push: {
        "audiobook.chapters": {
          chapterIndex,
          title,
          script: existing?.script || "",
          audioUrl: versionData.audioUrl,
          duration: versionData.duration || 0,
          charCount: versionData.charCount || 0,
          activeVersionId: versionId,
          versions,
          status,
          error: "",
          updatedAt: new Date(),
        },
      },
    }
  );

  return versionId;
}

async function setChapterFailed(bookId, chapterIndex, title, errorMessage = "") {
  const book = await Book.findById(bookId);
  const existing = (book?.audiobook?.chapters || []).find(
    (entry) => entry.chapterIndex === chapterIndex
  );

  if (existing) {
    await Book.updateOne(
      { _id: bookId, "audiobook.chapters.chapterIndex": chapterIndex },
      {
        $set: {
          "audiobook.chapters.$.status": "failed",
          "audiobook.chapters.$.title": title,
          "audiobook.chapters.$.error": errorMessage,
          "audiobook.chapters.$.updatedAt": new Date(),
        },
      }
    );
    return;
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $push: {
        "audiobook.chapters": {
          chapterIndex,
          title,
          script: existing?.script || "",
          audioUrl: "",
          duration: 0,
          charCount: 0,
          activeVersionId: "",
          versions: [],
          status: "failed",
          error: errorMessage,
          updatedAt: new Date(),
        },
      },
    }
  );
}

async function selectChapterVersion(bookId, chapterIndex, versionId) {
  const book = await Book.findById(bookId);
  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  const chapter = (book.audiobook?.chapters || []).find(
    (entry) => entry.chapterIndex === chapterIndex
  );

  if (!chapter) {
    const error = new Error("Chapter audio not found.");
    error.statusCode = 404;
    throw error;
  }

  const versions = normalizeChapterVersions(chapter, book.audiobook || {});
  const version = versions.find((entry) => entry.id === versionId);

  if (!version) {
    const error = new Error("Audio version not found.");
    error.statusCode = 404;
    throw error;
  }

  await Book.updateOne(
    { _id: bookId, "audiobook.chapters.chapterIndex": chapterIndex },
    {
      $set: {
        "audiobook.chapters.$.activeVersionId": versionId,
        "audiobook.chapters.$.audioUrl": version.audioUrl,
        "audiobook.chapters.$.duration": version.duration || 0,
        "audiobook.chapters.$.charCount": version.charCount || 0,
        "audiobook.chapters.$.versions": versions,
        "audiobook.chapters.$.updatedAt": new Date(),
      },
    }
  );

  const updatedBook = await Book.findById(bookId);
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
  getChapterActiveVersion,
  getChapterAlbumAudio,
  buildAlbumChapterTracks,
  calculateAudiobookTotalDuration,
  setChapterGenerating,
  appendChapterVersion,
  setChapterFailed,
  selectChapterVersion,
};
