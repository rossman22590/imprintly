const fs = require("fs");
const mm = require("music-metadata");
const Book = require("../models/Book");
const {
  listVoices,
  synthesizeSpeech,
  narrationTextFromMarkdown,
} = require("../utils/elevenlabs.generator");
const {
  calculateAudioCharge,
  getAudioCreditEstimate,
  chargeAudioUsage,
  assertHasCredits,
  roundCredits,
} = require("../utils/credits.service");
const { uploadAudioBufferToStorage } = require("../utils/image-storage");
const {
  createAudiobookJob,
  getAudiobookJob,
  cancelAudiobookJob,
  publicJob,
} = require("../utils/audiobook.jobs");
const {
  downloadUrlBuffer,
  fetchTrackBuffers,
  createZipAlbum,
  createM4bAlbum,
} = require("../utils/audiobook.album");
const {
  prepareOwnedBookForExport,
  setNoStoreHeaders,
} = require("../utils/book-export.service");
const {
  buildAlbumChapterTracks,
  selectChapterVersion: applyChapterVersionSelection,
} = require("../utils/audiobook.chapter");
const {
  appendIntroVersion,
  getIntroAlbumAudio,
  selectIntroVersion: applyIntroVersionSelection,
} = require("../utils/audiobook.intro");
const {
  buildChapterScriptsForBook,
  buildDefaultChapterScript,
  resolveChapterNarrationText,
  upsertChapterScript,
} = require("../utils/audiobook.script");

async function getOwnedBook(userId, bookId) {
  return prepareOwnedBookForExport(userId, bookId);
}

async function getAudiobook(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    return res.status(200).json({
      message: "Audiobook state retrieved successfully.",
      audiobook: book.audiobook || { status: "empty" },
      chapterScripts: buildChapterScriptsForBook(book),
      title: book.title,
      author: book.author,
      coverImage: book.coverImage,
      models: [
        { id: "eleven_v3", label: "Alpha V3 (High Quality)" },
        { id: "eleven_multilingual_v2", label: "Multilingual v2" },
        { id: "eleven_flash_v2_5", label: "Flash v2.5 (Fast & Budget)" },
        { id: "eleven_turbo_v2_5", label: "Turbo v2.5" },
      ],
    });
  } catch (error) {
    console.error("Error getting audiobook:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function getVoices(req, res) {
  try {
    const ENV = require("../configs/env");
    const voices = await listVoices({ search: req.query.search });
    return res.status(200).json({
      message: "Voices retrieved successfully.",
      voices,
      hasApiKey: Boolean(ENV.ELEVENLABS_API_KEY),
      models: [
        { id: "eleven_v3", label: "Alpha V3 (High Quality)" },
        { id: "eleven_multilingual_v2", label: "Multilingual v2" },
        { id: "eleven_flash_v2_5", label: "Flash v2.5 (Fast & Budget)" },
        { id: "eleven_turbo_v2_5", label: "Turbo v2.5" },
      ],
    });
  } catch (error) {
    console.error("Error listing voices:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function getAudiobookEstimate(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const { modelId, scope = "all", chapterIndex } = req.body;
    const perChapter = [];
    let totalCredits = 0;
    let totalCharCount = 0;

    const addEstimate = (idx, title, contentText) => {
      const charCount = contentText.length;
      const charge = calculateAudioCharge({ model: modelId, charCount });
      perChapter.push({
        chapterIndex: idx,
        title,
        charCount,
        credits: charge.credits,
        durationEstimate: Math.round(charCount / 15),
      });
      totalCredits += charge.credits;
      totalCharCount += charCount;
    };

    if (
      scope === "all" ||
      (scope === "chapter" && Number(chapterIndex) === -1)
    ) {
      if (
        book.audiobook?.intro?.mode === "generated" &&
        book.audiobook.intro.script
      ) {
        const text = narrationTextFromMarkdown(book.audiobook.intro.script);
        addEstimate(-1, "Introduction", text);
      }
    }

    if (scope === "all") {
      book.chapters.forEach((ch, idx) => {
        const text = resolveChapterNarrationText(book, idx);
        addEstimate(idx, ch.title || `Chapter ${idx + 1}`, text);
      });
    } else if (scope === "chapter" && Number(chapterIndex) >= 0) {
      const idx = Number(chapterIndex);
      const ch = book.chapters[idx];
      if (ch) {
        const text = resolveChapterNarrationText(book, idx);
        addEstimate(idx, ch.title || `Chapter ${idx + 1}`, text);
      }
    }

    return res.status(200).json({
      message: "Audiobook cost estimate calculated.",
      perChapter,
      totalCredits: roundCredits(totalCredits),
      totalCharCount,
    });
  } catch (error) {
    console.error("Error getting audiobook estimate:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function saveIntro(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const { mode, script } = req.body;

    if (!["none", "generated", "recorded"].includes(mode)) {
      return res.status(400).json({ error: "Invalid intro mode." });
    }

    if (mode === "none") {
      await Book.updateOne(
        { _id: book._id },
        {
          $set: {
            "audiobook.intro": {
              mode: "none",
              script: "",
              audioUrl: "",
              duration: 0,
              charCount: 0,
              activeVersionId: "",
              versions: [],
              updatedAt: new Date(),
            },
          },
        }
      );
      const updatedBook = await Book.findById(book._id);
      return res.status(200).json({
        message: "Intro removed.",
        audiobook: updatedBook.audiobook,
      });
    }

    if (mode === "generated") {
      const cleanText = narrationTextFromMarkdown(script);
      if (!cleanText) {
        return res
          .status(400)
          .json({ error: "Script text is required for generated intro." });
      }

      let voiceId = req.body.voiceId || book.audiobook?.voiceId;
      let voiceName = req.body.voiceName || book.audiobook?.voiceName;
      const modelId = req.body.modelId || book.audiobook?.modelId;
      const publicUserId = req.body.publicUserId;

      if (!voiceId) {
        return res.status(400).json({
          error:
            "Select an audiobook voice first before generating intro speech.",
        });
      }

      if (publicUserId) {
        const { addSharedVoice } = require("../utils/elevenlabs.generator");
        voiceId = await addSharedVoice({
          publicUserId,
          voiceId,
          voiceName,
        });
      }

      const estimate = getAudioCreditEstimate({
        model: modelId,
        charCount: cleanText.length,
      });
      await assertHasCredits(req.user.id, estimate);

      const buffer = await synthesizeSpeech({
        text: cleanText,
        voiceId,
        modelId,
      });

      const { downloadUrlBuffer } = require("../utils/audiobook.album");
      const NodeID3 = require("node-id3");

      const coverRes = book.coverImage ? await downloadUrlBuffer(book.coverImage) : null;
      const coverBuffer = coverRes?.buffer;
      const coverMimeType = coverRes?.mimeType;

      const introTags = {
        title: "Introduction",
        artist: book.author || "Unknown Author",
        album: book.title || "Unknown Album",
        TPE2: book.author || "Unknown Author",
        genre: "Audiobook",
        year: new Date().getFullYear().toString(),
        trackNumber: "0",
        comment: { language: "eng", text: "Generated by Bookify" },
      };

      if (coverBuffer) {
        introTags.image = {
          mime: coverMimeType || "image/png",
          type: { id: 3, name: "front cover" },
          description: "Cover Art",
          imageBuffer: coverBuffer,
        };
      }

      const taggedIntroBuffer = NodeID3.write(introTags, buffer);

      const audioUrl = await uploadAudioBufferToStorage(
        taggedIntroBuffer,
        `intro-${book._id}-${Date.now()}.mp3`
      );

      const metadata = await mm.parseBuffer(taggedIntroBuffer);
      const duration = metadata.format.duration || 0;

      await chargeAudioUsage({
        userId: req.user.id,
        reason: "audiobook_generation",
        description: `Generated introduction speech for "${book.title}"`,
        model: modelId,
        charCount: cleanText.length,
        metadata: { bookId: book._id.toString(), trackIndex: 0 },
      });

      await appendIntroVersion(
        book._id,
        {
          audioUrl,
          duration,
          charCount: cleanText.length,
          voiceId,
          voiceName: voiceName || book.audiobook?.voiceName || "",
          modelId: modelId || book.audiobook?.modelId || "",
        },
        {
          mode: "generated",
          script,
        }
      );

      const updatedBook = await Book.findById(book._id);
      return res.status(200).json({
        message: "Intro narration speech generated.",
        audiobook: updatedBook.audiobook,
      });
    }

    if (mode === "recorded") {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Recorded audio file is missing." });
      }

      const fileBuffer = await fs.promises.readFile(req.file.path);
      const audioUrl = await uploadAudioBufferToStorage(
        fileBuffer,
        req.file.filename,
        req.file.mimetype
      );

      const metadata = await mm.parseBuffer(fileBuffer);
      const duration = metadata.format.duration || 0;

      // Clean up uploaded file
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to delete temp recorded file:", err);
      }

      await appendIntroVersion(
        book._id,
        {
          audioUrl,
          duration,
          charCount: 0,
          voiceId: book.audiobook?.voiceId || "",
          voiceName: book.audiobook?.voiceName || "",
          modelId: book.audiobook?.modelId || "",
        },
        {
          mode: "recorded",
          script: "",
        }
      );

      const updatedBook = await Book.findById(book._id);
      return res.status(200).json({
        message: "Intro recording uploaded.",
        audiobook: updatedBook.audiobook,
      });
    }
  } catch (error) {
    console.error("Error saving audiobook intro:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    }
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function generate(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const { voiceId, voiceName, publicUserId, modelId, scope = "all", chapterIndex } = req.body;

    if (!voiceId) {
      return res
        .status(400)
        .json({ error: "ElevenLabs voice ID is required." });
    }

    if (scope === "chapter") {
      const idx = Number(chapterIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({
          error: "A valid chapterIndex is required for single-chapter generation.",
        });
      }

      const chapter = book.chapters[idx];
      if (!chapter) {
        return res.status(400).json({ error: "Chapter not found." });
      }

      const text = resolveChapterNarrationText(book, idx);
      if (!text.trim()) {
        return res.status(400).json({
          error: "This chapter has no narratable script text.",
        });
      }
    }

    const job = await createAudiobookJob({
      userId: req.user.id,
      bookId: book._id,
      payload: {
        voiceId,
        voiceName,
        publicUserId,
        modelId,
        scope,
        chapterIndex: scope === "chapter" ? Number(chapterIndex) : null,
      },
    });

    return res.status(202).json({
      message: "Audiobook generation started.",
      job,
    });
  } catch (error) {
    console.error("Error triggering audiobook generation:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function getJob(req, res) {
  try {
    const job = await getAudiobookJob(req.params.jobId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    return res.status(200).json({
      message: "Job status retrieved.",
      job: publicJob(job),
    });
  } catch (error) {
    console.error("Error getting audiobook job status:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function downloadZip(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const tracks = [];
    const introTrack = getIntroAlbumAudio(book.audiobook?.intro || {});
    if (introTrack) {
      tracks.push({
        title: introTrack.title,
        url: introTrack.audioUrl,
        trackIndex: 0,
      });
    }

    tracks.push(...buildAlbumChapterTracks(book.audiobook || {}));

    if (tracks.length === 0) {
      return res
        .status(400)
        .json({ error: "No generated audio tracks found to download." });
    }

    const tracksWithBuffers = await fetchTrackBuffers(tracks);
    const coverRes = book.coverImage
      ? await downloadUrlBuffer(book.coverImage)
      : null;

    const zipBuffer = await createZipAlbum(book, tracksWithBuffers, coverRes);
    const safeFilename = `${book.title.replace(/[^a-zA-Z0-9]/g, "_")}_audiobook.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    res.setHeader("Content-Length", zipBuffer.length);
    setNoStoreHeaders(res);

    return res.send(zipBuffer);
  } catch (error) {
    console.error("Error downloading ZIP album:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function downloadM4b(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const tracks = [];
    const introTrack = getIntroAlbumAudio(book.audiobook?.intro || {});
    if (introTrack) {
      tracks.push({
        title: introTrack.title,
        url: introTrack.audioUrl,
        trackIndex: 0,
      });
    }

    tracks.push(...buildAlbumChapterTracks(book.audiobook || {}));

    if (tracks.length === 0) {
      return res
        .status(400)
        .json({ error: "No generated audio tracks found to download." });
    }

    const tracksWithBuffers = await fetchTrackBuffers(tracks);
    const coverRes = book.coverImage
      ? await downloadUrlBuffer(book.coverImage)
      : null;

    const m4bBuffer = await createM4bAlbum(book, tracksWithBuffers, coverRes);
    const safeFilename = `${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.m4b`;

    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    res.setHeader("Content-Length", m4bBuffer.length);
    setNoStoreHeaders(res);

    return res.send(m4bBuffer);
  } catch (error) {
    console.error("Error downloading M4B audiobook:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function setChapterVersion(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const chapterIndex = Number(req.params.chapterIndex);
    const { versionId } = req.body;

    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
      return res.status(400).json({ error: "Invalid chapter index." });
    }

    if (!versionId) {
      return res.status(400).json({ error: "versionId is required." });
    }

    const updatedBook = await applyChapterVersionSelection(
      book._id,
      chapterIndex,
      versionId
    );

    return res.status(200).json({
      message: "Chapter album version updated.",
      audiobook: updatedBook.audiobook,
    });
  } catch (error) {
    console.error("Error selecting chapter version:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function setIntroVersion(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({ error: "versionId is required." });
    }

    const updatedBook = await applyIntroVersionSelection(book._id, versionId);

    return res.status(200).json({
      message: "Intro album version updated.",
      audiobook: updatedBook.audiobook,
    });
  } catch (error) {
    console.error("Error selecting intro version:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function saveChapterScript(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const chapterIndex = Number(req.params.chapterIndex);
    const { script } = req.body;

    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
      return res.status(400).json({ error: "Invalid chapter index." });
    }

    const chapter = book.chapters[chapterIndex];
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found." });
    }

    const cleanScript = String(script || "").trim();
    if (!cleanScript) {
      return res.status(400).json({ error: "Chapter script cannot be empty." });
    }

    const updatedBook = await upsertChapterScript(
      book._id,
      chapterIndex,
      chapter.title,
      cleanScript
    );

    return res.status(200).json({
      message: "Chapter script saved.",
      audiobook: updatedBook.audiobook,
      chapterScripts: buildChapterScriptsForBook(updatedBook),
    });
  } catch (error) {
    console.error("Error saving chapter script:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

async function resetChapterScript(req, res) {
  try {
    const book = await getOwnedBook(req.user.id, req.params.bookId);
    if (!book) return;

    const chapterIndex = Number(req.params.chapterIndex);

    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
      return res.status(400).json({ error: "Invalid chapter index." });
    }

    const chapter = book.chapters[chapterIndex];
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found." });
    }

    const defaultScript = buildDefaultChapterScript(chapter, chapterIndex);
    if (!defaultScript) {
      return res.status(400).json({
        error: "This chapter has no book content to build a script from.",
      });
    }

    const updatedBook = await upsertChapterScript(
      book._id,
      chapterIndex,
      chapter.title,
      defaultScript
    );

    return res.status(200).json({
      message: "Chapter script reset from book.",
      audiobook: updatedBook.audiobook,
      chapterScripts: buildChapterScriptsForBook(updatedBook),
      script: defaultScript,
    });
  } catch (error) {
    console.error("Error resetting chapter script:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

module.exports = {
  getAudiobook,
  getVoices,
  getAudiobookEstimate,
  saveIntro,
  saveChapterScript,
  resetChapterScript,
  generate,
  getJob,
  setChapterVersion,
  setIntroVersion,
  downloadZip,
  downloadM4b,
};
