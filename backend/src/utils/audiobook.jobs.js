const crypto = require("crypto");
const Book = require("../models/Book");
const GenerationJob = require("../models/GenerationJob");
const mm = require("music-metadata");
const {
  synthesizeSpeech,
  narrationTextFromMarkdown,
} = require("./elevenlabs.generator");
const { resolveChapterNarrationText } = require("./audiobook.script");
const { uploadAudioBufferToStorage } = require("./image-storage");
const {
  setChapterGenerating,
  appendChapterVersion,
  setChapterFailed,
  calculateAudiobookTotalDuration,
} = require("./audiobook.chapter");
const { appendIntroVersion } = require("./audiobook.intro");
const {
  assertHasCredits,
  chargeAudioUsage,
  getAudioCreditEstimate,
} = require("./credits.service");

const activeJobs = new Set();
let queueRunning = false;

function countWords(content = "") {
  return content.split(/\s+/).filter(Boolean).length;
}

function publicJob(job) {
  if (!job) return null;
  const payload = job.payload || {};
  return {
    id: job.id,
    userId: job.userId.toString(),
    bookId: job.bookId ? job.bookId.toString() : null,
    provider: job.provider,
    scope: payload.scope || "all",
    chapterIndex:
      payload.chapterIndex === null || payload.chapterIndex === undefined
        ? null
        : Number(payload.chapterIndex),
    retryFailedOnly: Boolean(job.retryFailedOnly),
    status: job.status,
    progress: job.progress,
    failedChapters: job.failedChapters || [],
    error: job.error || "",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function buildChaptersToNarrate(book, scope, chapterIndex) {
  const chaptersToNarrate = [];

  if (scope === "all") {
    book.chapters.forEach((ch, idx) => {
      const text = resolveChapterNarrationText(book, idx);
      if (text.length > 0) {
        chaptersToNarrate.push({
          chapterIndex: idx,
          title: ch.title || `Chapter ${idx + 1}`,
          text,
        });
      }
    });
    return chaptersToNarrate;
  }

  if (scope === "chapter" && Number.isInteger(Number(chapterIndex)) && Number(chapterIndex) >= 0) {
    const idx = Number(chapterIndex);
    const ch = book.chapters[idx];
    if (ch) {
      const text = resolveChapterNarrationText(book, idx);
      if (text.length > 0) {
        chaptersToNarrate.push({
          chapterIndex: idx,
          title: ch.title || `Chapter ${idx + 1}`,
          text,
        });
      }
    }
  }

  return chaptersToNarrate;
}

async function createAudiobookJob({ userId, bookId, payload }) {
  const id = crypto.randomUUID();
  const job = await GenerationJob.create({
    id,
    userId,
    bookId,
    provider: "elevenlabs",
    payload,
    retryFailedOnly: Boolean(payload.retryFailedOnly),
    cancelled: false,
    status: "queued",
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      currentChapterIndex: null,
      currentChapterTitle: "",
      message: "Queued",
    },
    failedChapters: [],
    error: "",
  });

  scheduleQueue();

  return publicJob(job);
}

async function getAudiobookJob(jobId, userId) {
  return GenerationJob.findOne({ id: jobId, userId });
}

async function cancelAudiobookJob(jobId, userId) {
  const job = await GenerationJob.findOne({ id: jobId, userId });
  if (!job) return null;

  if (["complete", "failed", "cancelled"].includes(job.status)) {
    return publicJob(job);
  }

  job.cancelled = true;
  job.status = "cancelled";
  job.completedAt = new Date();
  job.progress.message = "Cancelled";
  await job.save();

  if (job.bookId) {
    await Book.updateOne(
      { _id: job.bookId, userId },
      {
        $set: {
          "audiobook.status": "failed",
        },
      }
    );
  }

  return publicJob(job);
}

async function scheduleQueue() {
  if (queueRunning) return;
  queueRunning = true;

  try {
    while (true) {
      const job = await GenerationJob.findOneAndUpdate(
        { status: "queued", provider: "elevenlabs", cancelled: false },
        { $set: { status: "generating", startedAt: new Date() } },
        { new: true, sort: { createdAt: 1 } }
      );

      if (!job) break;

      activeJobs.add(job.id);
      try {
        await processAudiobookJob(job);
      } catch (err) {
        console.error(`Audiobook Job ${job.id} failed:`, err);
        job.status = "failed";
        job.error = err.message;
        job.completedAt = new Date();
        await job.save();

        if (job.bookId) {
          await Book.updateOne(
            { _id: job.bookId },
            { $set: { "audiobook.status": "failed" } }
          );
        }
      } finally {
        activeJobs.delete(job.id);
      }
    }
  } finally {
    queueRunning = false;
  }
}

async function processAudiobookJob(job) {
  const { bookId, payload, userId } = job;
  const { voiceId, voiceName, publicUserId, modelId, scope = "all", chapterIndex } = payload;

  const book = await Book.findById(bookId);
  if (!book) throw new Error("Book not found");

  const { downloadUrlBuffer } = require("./audiobook.album");
  const NodeID3 = require("node-id3");
  const coverRes = book.coverImage ? await downloadUrlBuffer(book.coverImage) : null;
  const coverBuffer = coverRes?.buffer;
  const coverMimeType = coverRes?.mimeType;

  let activeVoiceId = voiceId;
  if (publicUserId) {
    const { addSharedVoice } = require("./elevenlabs.generator");
    activeVoiceId = await addSharedVoice({
      publicUserId,
      voiceId,
      voiceName,
    });
  }

  // 1. Determine items to narrate and estimate credits
  let introToNarrate = null;
  const chaptersToNarrate = [];

  const checkCancelled = async () => {
    const freshJob = await GenerationJob.findById(job._id).select("cancelled");
    if (freshJob?.cancelled) {
      throw new Error("Job was cancelled by user.");
    }
  };

  if (scope === "all" || (scope === "chapter" && Number(chapterIndex) === -1)) {
    if (
      book.audiobook?.intro?.mode === "generated" &&
      book.audiobook.intro.script
    ) {
      const text = narrationTextFromMarkdown(book.audiobook.intro.script);
      if (text.length > 0) {
        introToNarrate = {
          text,
          rawScript: book.audiobook.intro.script,
        };
      }
    }
  }

  chaptersToNarrate.push(
    ...buildChaptersToNarrate(book, scope, chapterIndex)
  );

  // Calculate total credit estimate
  let totalChars = 0;
  if (introToNarrate) totalChars += introToNarrate.text.length;
  chaptersToNarrate.forEach((c) => {
    totalChars += c.text.length;
  });

  const estimatedCredits = getAudioCreditEstimate({
    model: modelId,
    charCount: totalChars,
  });

  // Pre-flight check
  await assertHasCredits(userId, estimatedCredits);

  const totalCount = (introToNarrate ? 1 : 0) + chaptersToNarrate.length;
  if (totalCount === 0) {
    const error = new Error(
      scope === "chapter"
        ? "No narratable text found for the selected chapter."
        : "No narratable text found in this book."
    );
    error.statusCode = 400;
    throw error;
  }

  // Initialize Book audiobook metadata status
  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        "audiobook.status": "generating",
        "audiobook.jobId": job.id,
        "audiobook.voiceId": activeVoiceId,
        "audiobook.voiceName": voiceName,
        "audiobook.modelId": modelId,
      },
    }
  );

  // Initialize progress
  let completedCount = 0;

  job.progress = {
    total: totalCount,
    completed: 0,
    failed: 0,
    currentChapterIndex: null,
    currentChapterTitle: "",
    message: "Starting narration generation...",
  };
  await job.save();

  // 2. Generate intro
  if (introToNarrate) {
    await checkCancelled();
    job.progress.message = "Narrating introduction script...";
    job.progress.currentChapterIndex = -1;
    job.progress.currentChapterTitle = "Introduction";
    await job.save();

    try {
      const buffer = await synthesizeSpeech({
        text: introToNarrate.text,
        voiceId: activeVoiceId,
        modelId,
      });

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
        `intro-${bookId}-${Date.now()}.mp3`
      );

      const metadata = await mm.parseBuffer(taggedIntroBuffer);
      const duration = metadata.format.duration || 0;

      await chargeAudioUsage({
        userId,
        reason: "audiobook_generation",
        description: `Narrated introduction for "${book.title}"`,
        model: modelId,
        charCount: introToNarrate.text.length,
        metadata: { bookId: bookId.toString(), trackIndex: 0 },
      });

      await appendIntroVersion(
        bookId,
        {
          audioUrl,
          duration,
          charCount: introToNarrate.text.length,
          voiceId: activeVoiceId,
          voiceName,
          modelId,
        },
        {
          mode: "generated",
          script: introToNarrate.rawScript,
        }
      );

      completedCount += 1;
      job.progress.completed = completedCount;
      await job.save();
    } catch (err) {
      console.error("Intro generation failed:", err);
      job.progress.failed += 1;
      await job.save();
      throw new Error(`Failed to generate introduction: ${err.message}`);
    }
  }

  // 3. Generate chapters
  for (const track of chaptersToNarrate) {
    await checkCancelled();
    job.progress.message = `Narrating chapter: ${track.title}`;
    job.progress.currentChapterIndex = track.chapterIndex;
    job.progress.currentChapterTitle = track.title;
    await job.save();

    await setChapterGenerating(bookId, track.chapterIndex, track.title);

    try {
      const buffer = await synthesizeSpeech({
        text: track.text,
        voiceId: activeVoiceId,
        modelId,
      });

      const trackNum = track.chapterIndex + 1;
      const chapterTags = {
        title: track.title,
        artist: book.author || "Unknown Author",
        album: book.title || "Unknown Album",
        TPE2: book.author || "Unknown Author",
        genre: "Audiobook",
        year: new Date().getFullYear().toString(),
        trackNumber: `${trackNum}`,
        comment: { language: "eng", text: "Generated by Bookify" },
      };
      if (coverBuffer) {
        chapterTags.image = {
          mime: coverMimeType || "image/png",
          type: { id: 3, name: "front cover" },
          description: "Cover Art",
          imageBuffer: coverBuffer,
        };
      }
      const taggedBuffer = NodeID3.write(chapterTags, buffer);

      const audioUrl = await uploadAudioBufferToStorage(
        taggedBuffer,
        `chapter-${track.chapterIndex}-${bookId}-${Date.now()}.mp3`
      );

      const metadata = await mm.parseBuffer(taggedBuffer);
      const duration = metadata.format.duration || 0;

      await chargeAudioUsage({
        userId,
        reason: "audiobook_generation",
        description: `Narrated chapter "${track.title}"`,
        model: modelId,
        charCount: track.text.length,
        metadata: {
          bookId: bookId.toString(),
          chapterIndex: track.chapterIndex,
        },
      });

      await appendChapterVersion(
        bookId,
        track.chapterIndex,
        track.title,
        {
          audioUrl,
          duration,
          charCount: track.text.length,
          voiceId: activeVoiceId,
          voiceName: voiceName || "",
          modelId: modelId || "",
        },
        "complete"
      );

      completedCount += 1;
      job.progress.completed = completedCount;
      await job.save();
    } catch (err) {
      console.error(`Chapter ${track.title} narration failed:`, err);
      job.progress.failed += 1;
      await job.save();

      await setChapterFailed(
        bookId,
        track.chapterIndex,
        track.title,
        err.message
      );

      throw new Error(
        `Failed to generate narration for "${track.title}": ${err.message}`
      );
    }
  }

  // 4. Update audiobook status to complete and calculate total duration
  const updatedBook = await Book.findById(bookId);
  const totalDuration = calculateAudiobookTotalDuration(updatedBook.audiobook || {});

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        "audiobook.status": "complete",
        "audiobook.totalDuration": totalDuration,
        "audiobook.lastGeneratedAt": new Date(),
      },
    }
  );

  job.status = "complete";
  job.completedAt = new Date();
  job.progress.message = "Narration generation complete!";
  await job.save();
}

// Automatically recover interrupted jobs on boot
async function recoverInterruptedJobs() {
  try {
    const interrupted = await GenerationJob.find({
      status: { $in: ["queued", "generating"] },
      provider: "elevenlabs",
    });

    for (const job of interrupted) {
      job.status = "failed";
      job.error = "Server rebooted during audiobook generation.";
      job.completedAt = new Date();
      await job.save();

      if (job.bookId) {
        await Book.updateOne(
          { _id: job.bookId },
          { $set: { "audiobook.status": "failed" } }
        );
      }
    }
  } catch (error) {
    console.error("Error recovering interrupted audiobook jobs:", error);
  }
}

// Run recovery on load
recoverInterruptedJobs();

module.exports = {
  createAudiobookJob,
  getAudiobookJob,
  cancelAudiobookJob,
  scheduleQueue,
  publicJob,
};
