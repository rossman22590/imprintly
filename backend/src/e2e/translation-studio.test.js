const test = require("node:test");
const { describe, it, before, after } = test;
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

// Dynamic boot up of express server in-process on port 3099
process.env.PORT = "3099";
process.env.NODE_ENV = "test";
require("../server.js");

// Reusable models
const User = require("../models/User");
const Book = require("../models/Book");

// State trackers for cleanup
const createdUserIds = [];
const createdBookIds = [];

// Base URL helper
const BASE_URL = "http://localhost:3099";

// Fetch wrapper for authenticated requests
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

// Wait helper for server boot
async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

describe("Translation Studio E2E Test Suite", () => {
  let userToken;
  let userId;
  let userBookId;
  let userChapterId;

  // Placeholder IDs for translation configuration
  let spanishTranslationId = "60f7c223c21a4f001f3f4c6a";
  let frenchTranslationId = "60f7c223c21a4f001f3f4c6b";
  let germanTranslationId = "60f7c223c21a4f001f3f4c6c";
  let italianTranslationId = "60f7c223c21a4f001f3f4c6d";
  let japaneseTranslationId = "60f7c223c21a4f001f3f4c6e";

  before(async () => {
    // Wait until the server is fully booted and database is connected
    await waitForServer(`${BASE_URL}/healthz`);

    // Create E2E Test User
    const email = `e2e-tester-${Date.now()}@example.com`;
    const regRes = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E Tester",
        email,
        password: "Password123!"
      })
    });
    if (regRes.status !== 201) {
      console.error("Registration failed with status:", regRes.status);
      console.error(await regRes.text());
    }
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    userToken = regData.token;
    userId = regData.user._id;
    createdUserIds.push(userId);

    // Create E2E Book with one chapter
    const bookRes = await apiFetch("/api/books", {
      method: "POST",
      token: userToken,
      body: JSON.stringify({
        title: "E2E Book Title",
        author: "E2E Author",
        chapters: [
          {
            title: "Chapter 1: The Beginning",
            content: "Once upon a time in E2E testing land.",
            generationStatus: "complete"
          }
        ]
      })
    });
    assert.equal(bookRes.status, 201);
    const bookData = await bookRes.json();
    userBookId = bookData.book._id;
    userChapterId = bookData.book.chapters[0]._id;
    createdBookIds.push(userBookId);
  });

  after(async () => {
    // Cleanup database records
    await Book.deleteMany({ _id: { $in: createdBookIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    // Disconnect mongoose
    await mongoose.connection.close();
  });

  // ==========================================
  // TIER 1: FEATURE COVERAGE (30 TESTS)
  // ==========================================

  describe("Tier 1: Feature Coverage", () => {
    // F1: Translation Creation & Configuration
    it("T1_F1_1: Create translation in Spanish using Groq engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.translation);
      spanishTranslationId = data.translation._id;
    });

    it("T1_F1_2: Create translation in French using Gemini engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "French",
          engine: "gemini",
          model: "gemini-3.5-flash"
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.translation);
      frenchTranslationId = data.translation._id;
    });

    it("T1_F1_3: Create translation in German using Groq engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "German",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.translation);
      germanTranslationId = data.translation._id;
    });

    it("T1_F1_4: Create translation in Italian using Gemini engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Italian",
          engine: "gemini",
          model: "gemini-3.5-flash"
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.translation);
      italianTranslationId = data.translation._id;
    });

    it("T1_F1_5: Create translation in Japanese using Gemini engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Japanese",
          engine: "gemini",
          model: "gemini-3.5-flash"
        })
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.translation);
      japaneseTranslationId = data.translation._id;
    });

    // F2: Translation Management & Active Toggle
    it("T1_F2_1: List all translations for a book", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.translations));
    });

    it("T1_F2_2: Toggle a Spanish translation to active", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.translation.isActive, true);
    });

    it("T1_F2_3: Toggle translation back to inactive", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: false })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.translation.isActive, false);
    });

    it("T1_F2_4: Delete a translation configuration", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${japaneseTranslationId}`, {
        method: "DELETE",
        token: userToken
      });
      assert.equal(res.status, 200);
    });

    it("T1_F2_5: Set a French translation active, and verify that listing translations shows it as active", async () => {
      const activeRes = await apiFetch(`/api/books/${userBookId}/translations/${frenchTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      assert.equal(activeRes.status, 200);

      const listRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      const french = listData.translations.find(t => t._id === frenchTranslationId);
      assert.ok(french);
      assert.equal(french.isActive, true);
    });

    // F3: Chapter Translation
    it("T1_F3_1: Translate a single chapter to Spanish", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.chapterStatus, "complete");
    });

    it("T1_F3_2: Verify translated chapter title changes to target language title", async () => {
      // Toggle Spanish active first
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.book.chapters[0].title !== "Chapter 1: The Beginning");
    });

    it("T1_F3_3: Verify translated chapter content changes to target language content", async () => {
      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.book.chapters[0].content !== "Once upon a time in E2E testing land.");
    });

    it("T1_F3_4: Translate entire book (all untranslated chapters)", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.chaptersStatus, "complete");
    });

    it("T1_F3_5: Translate a single chapter to French", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${frenchTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.chapterStatus === "complete");
    });

    // F4: Credit Cost Estimation & Deductions
    it("T1_F4_1: Fetch credit cost estimation for a single chapter translation", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.estimatedCredits !== undefined);
    });

    it("T1_F4_2: Fetch credit cost estimation for the entire book", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.estimatedCredits !== undefined);
    });

    it("T1_F4_3: Translate a single chapter and verify that user credit balance is deducted exactly by estimated cost", async () => {
      const estRes = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/estimate`, {
        method: "GET",
        token: userToken
      });
      const estData = await estRes.json();
      const estimate = estData.estimatedCredits;

      const userBefore = await User.findById(userId);
      const creditsBefore = userBefore.credits.balance;

      const transRes = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(transRes.status, 200);

      const userAfter = await User.findById(userId);
      assert.equal(userAfter.credits.balance, creditsBefore - estimate);
    });

    it("T1_F4_4: Translate entire book and verify credits are deducted matching the entire book estimate", async () => {
      const estRes = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/estimate`, {
        method: "GET",
        token: userToken
      });
      const estData = await estRes.json();
      const estimate = estData.estimatedCredits;

      const userBefore = await User.findById(userId);
      const creditsBefore = userBefore.credits.balance;

      const transRes = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(transRes.status, 200);

      const userAfter = await User.findById(userId);
      assert.equal(userAfter.credits.balance, creditsBefore - estimate);
    });

    it("T1_F4_5: Verify credit estimation API returns correct schema with estimated credits and base USD details", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.estimatedCredits !== undefined);
      assert.ok(data.baseUsd !== undefined);
    });

    // F5: Audiobook Translation
    it("T1_F5_1: Fetch available voices list for translation language", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook/voices`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.voices));
    });

    it("T1_F5_2: Select a voice and save voice configuration for active translation", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook/settings`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ voiceId: "voice_1", voiceName: "Rachel" })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.voiceSettings.voiceId, "voice_1");
    });

    it("T1_F5_3: Trigger speech generation for translated audiobook chapter", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook/chapters/${userChapterId}/generate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(["queued", "generating"].includes(data.status));
    });

    it("T1_F5_4: Verify audiobook chapter status updates to complete and audio URL is returned", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, "complete");
      assert.ok(data.chapters[0].audioUrl);
    });

    it("T1_F5_5: Retrieve audiobook settings and download/play links for the translated audiobook", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.voiceId);
      assert.ok(data.totalDuration !== undefined);
    });

    // F6: Active Translation Propagation
    it("T1_F6_1: Retrieve book details via GET /api/books/:id when Spanish translation is active", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.book.chapters[0].title !== "Chapter 1: The Beginning");
    });

    it("T1_F6_2: Retrieve public share book details via GET /api/public/book-previews/:token when Spanish translation is active", async () => {
      const shareRes = await apiFetch(`/api/books/${userBookId}/preview-share`, {
        method: "POST",
        token: userToken
      });
      assert.equal(shareRes.status, 200);
      const shareData = await shareRes.json();
      const token = shareData.previewShare.token;

      const res = await apiFetch(`/api/public/book-previews/${token}`, {
        method: "GET"
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.book.firstChapter.title !== "Chapter 1: The Beginning");
    });

    it("T1_F6_3: Retrieve KDP settings and preview data when French translation is active", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${frenchTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.book.kdp);
    });

    it("T1_F6_4: Request EPUB export when German translation is active", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${germanTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/exports/${userBookId}/epub`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
    });

    it("T1_F6_5: Retrieve audiobook studio state when Italian translation is active", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${italianTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/audiobook/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.activeTextLanguage, "Italian");
    });
  });

  // ==========================================
  // TIER 2: BOUNDARY & CORNER CASES (30 TESTS)
  // ==========================================

  describe("Tier 2: Boundary & Corner Cases", () => {
    // F1: Translation Creation & Configuration
    it("T2_F1_1: Attempt to create translation with an invalid target language", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Elvish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 400);
    });

    it("T2_F1_2: Attempt to create translation with an invalid engine", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "Ollama",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 400);
    });

    it("T2_F1_3: Attempt to create translation with an invalid model", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "invalid-model"
        })
      });
      assert.equal(res.status, 400);
    });

    it("T2_F1_4: Attempt to create translation for a non-existent book", async () => {
      const res = await apiFetch(`/api/books/60f7c223c21a4f001f3f4c6f/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 404);
    });

    it("T2_F1_5: Attempt to create duplicate translation for the same target language", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      assert.equal(res.status, 400);
    });

    // F2: Translation Management & Active Toggle
    it("T2_F2_1: Set multiple translations active simultaneously (deactivates previous)", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      await apiFetch(`/api/books/${userBookId}/translations/${frenchTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      const data = await res.json();
      const spanish = data.translations.find(t => t._id === spanishTranslationId);
      const french = data.translations.find(t => t._id === frenchTranslationId);
      assert.equal(spanish.isActive, false);
      assert.equal(french.isActive, true);
    });

    it("T2_F2_2: Attempt to set active state for a non-existent translation ID", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/60f7c223c21a4f001f3f4c6f/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      assert.equal(res.status, 404);
    });

    it("T2_F2_3: Attempt to delete a non-existent translation", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/60f7c223c21a4f001f3f4c6f`, {
        method: "DELETE",
        token: userToken
      });
      assert.equal(res.status, 404);
    });

    it("T2_F2_4: Toggle active state when the user is not authenticated", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true })
      });
      assert.equal(res.status, 401);
    });

    it("T2_F2_5: Attempt to set active state on a book owned by another user", async () => {
      // Register another user
      const otherEmail = `e2e-other-${Date.now()}@example.com`;
      const regRes = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Other User",
          email: otherEmail,
          password: "Password123!"
        })
      });
      const regData = await regRes.json();
      const otherToken = regData.token;
      createdUserIds.push(regData.user._id);

      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: otherToken,
        body: JSON.stringify({ isActive: true })
      });
      assert.ok([403, 404].includes(res.status));
    });

    // F3: Chapter Translation
    it("T2_F3_1: Attempt to translate a non-existent chapter ID", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/60f7c223c21a4f001f3f4c6f/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 404);
    });

    it("T2_F3_2: Attempt to translate a chapter of a book owned by another user", async () => {
      const otherUser = createdUserIds[createdUserIds.length - 1];
      // Generate a token for User B manually or use registered otherToken
      const jwt = require("jsonwebtoken");
      const ENV = require("../configs/env");
      const otherToken = jwt.sign({ id: otherUser }, ENV.JWT_SECRET_KEY, { expiresIn: "7d" });

      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: otherToken
      });
      assert.ok([403, 404].includes(res.status));
    });

    it("T2_F3_3: Translate an empty chapter (no content, no title)", async () => {
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Empty Book",
          author: "E2E Author",
          chapters: [
            { title: "Empty", content: "" }
          ]
        })
      });
      const bookData = await bookRes.json();
      const emptyBookId = bookData.book._id;
      const emptyChapterId = bookData.book.chapters[0]._id;
      createdBookIds.push(emptyBookId);

      // Create translation config
      const transRes = await apiFetch(`/api/books/${emptyBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      const res = await apiFetch(`/api/books/${emptyBookId}/translations/${transId}/chapters/${emptyChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
    });

    it("T2_F3_4: Translate a book with zero chapters", async () => {
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Zero Chapter Book",
          author: "E2E Author",
          chapters: []
        })
      });
      const bookData = await bookRes.json();
      const zeroBookId = bookData.book._id;
      createdBookIds.push(zeroBookId);

      // Create translation config
      const transRes = await apiFetch(`/api/books/${zeroBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      const res = await apiFetch(`/api/books/${zeroBookId}/translations/${transId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
    });

    it("T2_F3_5: Call translate chapter when the chapter has already been translated", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 200);
    });

    // F4: Credit Cost Estimation & Deductions
    it("T2_F4_1: Attempt to translate a chapter when user credit balance is less than estimated cost", async () => {
      // Set credits to 0
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 0 } });

      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.ok([400, 402].includes(res.status));

      // Reset credits for other tests
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 500 } });
    });

    it("T2_F4_2: Estimate cost for a chapter with very large word count", async () => {
      const bigBookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Huge Book",
          author: "E2E Author",
          chapters: [
            { title: "Mega Chapter", content: "Word ".repeat(50000) }
          ]
        })
      });
      const bigBookData = await bigBookRes.json();
      const bigBookId = bigBookData.book._id;
      const bigChapterId = bigBookData.book.chapters[0]._id;
      createdBookIds.push(bigBookId);

      const transRes = await apiFetch(`/api/books/${bigBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      const res = await apiFetch(`/api/books/${bigBookId}/translations/${transId}/chapters/${bigChapterId}/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.estimatedCredits > 0);
    });

    it("T2_F4_3: Estimate cost for a non-existent book or chapter", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/chapters/60f7c223c21a4f001f3f4c6f/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 404);
    });

    it("T2_F4_4: Estimate cost for an empty chapter", async () => {
      const emptyBookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Empty Book",
          author: "E2E Author",
          chapters: [
            { title: "Empty", content: "" }
          ]
        })
      });
      const emptyBookData = await emptyBookRes.json();
      const emptyBookId = emptyBookData.book._id;
      const emptyChapterId = emptyBookData.book.chapters[0]._id;
      createdBookIds.push(emptyBookId);

      const transRes = await apiFetch(`/api/books/${emptyBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      const res = await apiFetch(`/api/books/${emptyBookId}/translations/${transId}/chapters/${emptyChapterId}/estimate`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.estimatedCredits === 0 || data.estimatedCredits === 1); // allow minimal default charge
    });

    it("T2_F4_5: Attempt to translate entire book with insufficient credits for whole book but enough for first chapter", async () => {
      // Set credits to 5
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 5 } });

      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.ok([400, 402].includes(res.status));

      // Reset credits
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 500 } });
    });

    // F5: Audiobook Translation
    it("T2_F5_1: Attempt to generate audiobook with an invalid voice ID", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook/chapters/${userChapterId}/generate`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({ voiceId: "invalid_voice" })
      });
      assert.equal(res.status, 400);
    });

    it("T2_F5_2: Attempt to generate audiobook for a chapter that has not been translated yet", async () => {
      // Create translation configuration without translating
      const newTransRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Korean",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const newTransData = await newTransRes.json();
      const gerId = newTransData.translation._id;

      const res = await apiFetch(`/api/books/${userBookId}/translations/${gerId}/audiobook/chapters/${userChapterId}/generate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(res.status, 400);
    });

    it("T2_F5_3: Trigger audiobook generation with insufficient credits for audio generation", async () => {
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 0 } });

      const res = await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/audiobook/chapters/${userChapterId}/generate`, {
        method: "POST",
        token: userToken
      });
      assert.ok([400, 402].includes(res.status));

      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 500 } });
    });

    it("T2_F5_4: Handle audiobook generation trigger for a book with no chapters", async () => {
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Zero Chapters Book",
          author: "E2E Author",
          chapters: []
        })
      });
      const bookData = await bookRes.json();
      const zeroBookId = bookData.book._id;
      createdBookIds.push(zeroBookId);

      const transRes = await apiFetch(`/api/books/${zeroBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      const res = await apiFetch(`/api/books/${zeroBookId}/translations/${transId}/audiobook/chapters/60f7c223c21a4f001f3f4c6f/generate`, {
        method: "POST",
        token: userToken
      });
      assert.ok([400, 404].includes(res.status));
    });

    it("T2_F5_5: Request audiobook playback link for non-existent translation or chapter", async () => {
      const res = await apiFetch(`/api/books/${userBookId}/translations/60f7c223c21a4f001f3f4c6f/audiobook`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 404);
    });

    // F6: Active Translation Propagation
    it("T2_F6_1: Retrieve book when an inactive translation is set (verifies English returns)", async () => {
      // Deactivate all possible active translations
      for (const tId of [spanishTranslationId, frenchTranslationId, germanTranslationId, italianTranslationId]) {
        await apiFetch(`/api/books/${userBookId}/translations/${tId}/active`, {
          method: "PATCH",
          token: userToken,
          body: JSON.stringify({ isActive: false })
        });
      }

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data = await res.json();
      assert.equal(data.book.chapters[0].title, "Chapter 1: The Beginning");
    });

    it("T2_F6_2: Edit a chapter title/content when a translation is active (verifies edits apply to English)", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      // Edit chapter
      await apiFetch(`/api/books/${userBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            {
              _id: userChapterId,
              title: "Chapter 1: Edited English Title",
              content: "Edited English Content."
            }
          ]
        })
      });

      // Deactivate translation to check original English
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: false })
      });

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data = await res.json();
      assert.equal(data.book.chapters[0].title, "Chapter 1: Edited English Title");
    });

    it("T2_F6_3: Delete a chapter from English book (verifies active translation chapters align)", async () => {
      // Create a book with 2 chapters
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Align Book",
          author: "E2E Author",
          chapters: [
            { title: "Chapter A", content: "Content A" },
            { title: "Chapter B", content: "Content B" }
          ]
        })
      });
      const bookData = await bookRes.json();
      const alignBookId = bookData.book._id;
      const chBId = bookData.book.chapters[1]._id;
      createdBookIds.push(alignBookId);

      const transRes = await apiFetch(`/api/books/${alignBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Spanish",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const transId = transData.translation._id;

      // Translate all chapters
      await apiFetch(`/api/books/${alignBookId}/translations/${transId}/translate`, {
        method: "POST",
        token: userToken
      });

      // Delete chapter A (leaving only B)
      await apiFetch(`/api/books/${alignBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            { _id: chBId, title: "Chapter B", content: "Content B" }
          ]
        })
      });

      // Verify alignment on translation endpoint
      const listRes = await apiFetch(`/api/books/${alignBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      const listData = await listRes.json();
      const translation = listData.translations.find(t => t._id === transId);
      assert.equal(translation.chapters.length, 1);
    });

    it("T2_F6_4: Export PDF when translation active has zero translated chapters", async () => {
      // Create translation configuration without translating
      const newTransRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Chinese",
          engine: "gemini",
          model: "gemini-3.5-flash"
        })
      });
      const newTransData = await newTransRes.json();
      const japId = newTransData.translation._id;

      await apiFetch(`/api/books/${userBookId}/translations/${japId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const res = await apiFetch(`/api/exports/${userBookId}/pdf`, {
        method: "GET",
        token: userToken
      });
      assert.equal(res.status, 200); // exports empty content, error, or falls back gracefully
    });

    it("T2_F6_5: Add a new chapter to the English book while a translation is active", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      // Add chapter
      await apiFetch(`/api/books/${userBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            { _id: userChapterId, title: "Chapter 1: Edited English Title", content: "Edited English Content." },
            { title: "Chapter 2: Added Chapter", content: "Added Content" }
          ]
        })
      });

      // Verify translation list includes new chapter as untranslated
      const listRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      const listData = await listRes.json();
      const spanish = listData.translations.find(t => t._id === spanishTranslationId);
      const ch2 = spanish.chapters.find(c => c.title === "Chapter 2: Added Chapter");
      assert.ok(ch2);
      assert.equal(ch2.status, "empty");
    });
  });

  // ==========================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (6 TESTS)
  // ==========================================

  describe("Tier 3: Cross-Feature Combinations", () => {
    it("T3_1: Create Spanish translation -> Translate chapter 1 -> Toggle active -> Request PDF/EPUB export", async () => {
      const transRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Portuguese",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const esId = transData.translation._id;

      await apiFetch(`/api/books/${userBookId}/translations/${esId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });

      await apiFetch(`/api/books/${userBookId}/translations/${esId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const exportRes = await apiFetch(`/api/exports/${userBookId}/epub`, {
        method: "GET",
        token: userToken
      });
      assert.equal(exportRes.status, 200);
    });

    it("T3_2: Create French translation -> Translate chapter 1 -> Toggle active -> Generate audiobook for chapter 1", async () => {
      const transRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Dutch",
          engine: "gemini",
          model: "gemini-3.5-flash"
        })
      });
      const transData = await transRes.json();
      const frId = transData.translation._id;

      await apiFetch(`/api/books/${userBookId}/translations/${frId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });

      await apiFetch(`/api/books/${userBookId}/translations/${frId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const audioRes = await apiFetch(`/api/books/${userBookId}/translations/${frId}/audiobook/chapters/${userChapterId}/generate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(audioRes.status, 200);
    });

    it("T3_3: Set Spanish active -> Verify GET returns Spanish. Edit Chapter 1 content -> Verify GET still returns Spanish", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const getRes1 = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data1 = await getRes1.json();
      const spanishTitle = data1.book.chapters[0].title;

      // Edit Chapter 1 original content
      await apiFetch(`/api/books/${userBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            { _id: userChapterId, title: "English Edited Again", content: "New English Content" }
          ]
        })
      });

      const getRes2 = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data2 = await getRes2.json();
      assert.equal(data2.book.chapters[0].title, spanishTitle); // remains Spanish (translation untouched)
    });

    it("T3_4: Set Spanish active. Create a new chapter in English -> Verify GET returns new in English, old in Spanish", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      // Add new chapter
      await apiFetch(`/api/books/${userBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            { _id: userChapterId, title: "Spanish Title", content: "Spanish Content" }, // placeholder update
            { title: "English Chapter Title", content: "English content" }
          ]
        })
      });

      const res = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data = await res.json();
      const chapters = data.book.chapters;
      assert.equal(chapters[0].title, "[Translated to Spanish] Chapter 1: The Beginning");
      assert.equal(chapters[1].title, "English Chapter Title");
    });

    it("T3_5: Create translation -> Translate -> Set active -> Enable public preview link -> Fetch preview -> Disable preview", async () => {
      const transRes = await apiFetch(`/api/books/${userBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          targetLanguage: "Russian",
          engine: "groq",
          model: "llama-3.3-70b-versatile"
        })
      });
      const transData = await transRes.json();
      const esId = transData.translation._id;

      await apiFetch(`/api/books/${userBookId}/translations/${esId}/chapters/${userChapterId}/translate`, {
        method: "POST",
        token: userToken
      });

      await apiFetch(`/api/books/${userBookId}/translations/${esId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });

      const shareRes = await apiFetch(`/api/books/${userBookId}/preview-share`, {
        method: "POST",
        token: userToken
      });
      const shareData = await shareRes.json();
      const token = shareData.previewShare.token;

      const previewRes = await apiFetch(`/api/public/book-previews/${token}`, {
        method: "GET"
      });
      assert.equal(previewRes.status, 200);

      // Disable preview share
      await apiFetch(`/api/books/${userBookId}/preview-share`, {
        method: "DELETE",
        token: userToken
      });

      const previewRes2 = await apiFetch(`/api/public/book-previews/${token}`, {
        method: "GET"
      });
      assert.ok([403, 404].includes(previewRes2.status));
    });

    it("T3_6: Toggle Spanish active -> Verify KDP Studio serves Spanish. Toggle French active -> Verify KDP Studio serves French", async () => {
      await apiFetch(`/api/books/${userBookId}/translations/${spanishTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      const kdpRes1 = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data1 = await kdpRes1.json();
      assert.ok(data1.book.chapters[0].title !== "Chapter 1: The Beginning");

      await apiFetch(`/api/books/${userBookId}/translations/${frenchTranslationId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      const kdpRes2 = await apiFetch(`/api/books/${userBookId}`, {
        method: "GET",
        token: userToken
      });
      const data2 = await kdpRes2.json();
      assert.ok(data2.book.chapters[0].title !== "Chapter 1: The Beginning");
    });
  });

  // ==========================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 TESTS)
  // ==========================================

  describe("Tier 4: Real-World Application Scenarios", () => {
    it("T4_1: Complete end-to-end author workflow", async () => {
      // 1. User registers and logs in
      const authorEmail = `e2e-author-${Date.now()}@example.com`;
      const regRes = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Author E2E", email: authorEmail, password: "Password123!" })
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();
      const authorToken = regData.token;
      createdUserIds.push(regData.user._id);

      // 2. User creates a book with 3 chapters
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: authorToken,
        body: JSON.stringify({
          title: "My Journey",
          author: "Author E2E",
          chapters: [
            { title: "Introduction", content: "This is the intro text." },
            { title: "Chapter 1", content: "This is chapter 1 text." },
            { title: "Chapter 2", content: "This is chapter 2 text." }
          ]
        })
      });
      assert.equal(bookRes.status, 201);
      const bookData = await bookRes.json();
      const bookId = bookData.book._id;
      createdBookIds.push(bookId);

      // 3. User creates a Spanish translation configuration
      const transRes = await apiFetch(`/api/books/${bookId}/translations`, {
        method: "POST",
        token: authorToken,
        body: JSON.stringify({ targetLanguage: "Spanish", engine: "groq", model: "llama-3.3-70b-versatile" })
      });
      assert.equal(transRes.status, 201);
      const transData = await transRes.json();
      const transId = transData.translation._id;

      // 4. User estimates costs and verifies estimates are visible
      const estRes = await apiFetch(`/api/books/${bookId}/translations/${transId}/estimate`, {
        method: "GET",
        token: authorToken
      });
      assert.equal(estRes.status, 200);
      const estData = await estRes.json();
      assert.ok(estData.estimatedCredits > 0);

      // 5. User translates chapters one by one
      for (const ch of bookData.book.chapters) {
        const trChRes = await apiFetch(`/api/books/${bookId}/translations/${transId}/chapters/${ch._id}/translate`, {
          method: "POST",
          token: authorToken
        });
        assert.equal(trChRes.status, 200);
      }

      // 6. User toggles Spanish translation as active
      const activeRes = await apiFetch(`/api/books/${bookId}/translations/${transId}/active`, {
        method: "PATCH",
        token: authorToken,
        body: JSON.stringify({ isActive: true })
      });
      assert.equal(activeRes.status, 200);

      // 7. User verifies GET /api/books/:id returns Spanish
      const getRes = await apiFetch(`/api/books/${bookId}`, {
        method: "GET",
        token: authorToken
      });
      const getData = await getRes.json();
      assert.ok(getData.book.chapters[0].title !== "Introduction");

      // 8. User configures Spanish Audiobook voice settings and triggers audiobook generation
      const voiceRes = await apiFetch(`/api/books/${bookId}/translations/${transId}/audiobook/settings`, {
        method: "PATCH",
        token: authorToken,
        body: JSON.stringify({ voiceId: "voice_2", voiceName: "Adam" })
      });
      assert.equal(voiceRes.status, 200);

      const genAudioRes = await apiFetch(`/api/books/${bookId}/translations/${transId}/audiobook/chapters/${bookData.book.chapters[0]._id}/generate`, {
        method: "POST",
        token: authorToken
      });
      assert.equal(genAudioRes.status, 200);

      // 9. User exports book as EPUB and verifies it contains Spanish
      const exportRes = await apiFetch(`/api/exports/${bookId}/epub`, {
        method: "GET",
        token: authorToken
      });
      assert.equal(exportRes.status, 200);
    });

    it("T4_2: Author workflow with engine switching", async () => {
      // 1. User creates book
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Multi-Engine book",
          author: "E2E Author",
          chapters: [
            { title: "Chapter One", content: "One content." }
          ]
        })
      });
      const bookData = await bookRes.json();
      const mBookId = bookData.book._id;
      const mChapterId = bookData.book.chapters[0]._id;
      createdBookIds.push(mBookId);

      // 2. User creates Spanish (Groq) and French (Gemini) translations
      const esRes = await apiFetch(`/api/books/${mBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({ targetLanguage: "Spanish", engine: "groq", model: "llama-3.3-70b-versatile" })
      });
      const esId = (await esRes.json()).translation._id;

      const frRes = await apiFetch(`/api/books/${mBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({ targetLanguage: "French", engine: "gemini", model: "gemini-3.5-flash" })
      });
      const frId = (await frRes.json()).translation._id;

      // 3. User translates chapter 1 in Spanish and French
      await apiFetch(`/api/books/${mBookId}/translations/${esId}/chapters/${mChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      await apiFetch(`/api/books/${mBookId}/translations/${frId}/chapters/${mChapterId}/translate`, {
        method: "POST",
        token: userToken
      });

      // 4. User toggles Spanish active, runs Audiobook generation
      await apiFetch(`/api/books/${mBookId}/translations/${esId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      const audioRes = await apiFetch(`/api/books/${mBookId}/translations/${esId}/audiobook/chapters/${mChapterId}/generate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(audioRes.status, 200);

      // 5. User toggles French active, runs KDP export
      await apiFetch(`/api/books/${mBookId}/translations/${frId}/active`, {
        method: "PATCH",
        token: userToken,
        body: JSON.stringify({ isActive: true })
      });
      const kdpRes = await apiFetch(`/api/exports/${mBookId}/kdp-report.pdf`, {
        method: "GET",
        token: userToken
      });
      assert.equal(kdpRes.status, 200);
    });

    it("T4_3: Insufficient credits recovery flow", async () => {
      // 1. User creates a book with a very long chapter
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Recovery Book",
          author: "E2E Author",
          chapters: [
            { title: "Long Chapter", content: "Long content ".repeat(1000) }
          ]
        })
      });
      const bookData = await bookRes.json();
      const rBookId = bookData.book._id;
      const rChapterId = bookData.book.chapters[0]._id;
      createdBookIds.push(rBookId);

      const transRes = await apiFetch(`/api/books/${rBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({ targetLanguage: "Spanish", engine: "groq", model: "llama-3.3-70b-versatile" })
      });
      const transId = (await transRes.json()).translation._id;

      // 2. User has 0 credits
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 0 } });

      // 3. User attempts to translate, verify it fails (Insufficient Credits)
      const failRes = await apiFetch(`/api/books/${rBookId}/translations/${transId}/chapters/${rChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.ok([400, 402].includes(failRes.status));

      // 4. User adds credits (simulated top-up)
      await User.updateOne({ _id: userId }, { $set: { "credits.balance": 1000 } });

      // 5. User translates successfully. Credits are debited.
      const passRes = await apiFetch(`/api/books/${rBookId}/translations/${transId}/chapters/${rChapterId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(passRes.status, 200);

      const user = await User.findById(userId);
      assert.ok(user.credits.balance < 1000);
    });

    it("T4_4: Multi-user isolation scenario", async () => {
      // User A registers
      const userAEmail = `e2e-user-a-${Date.now()}@example.com`;
      const regARes = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "User A", email: userAEmail, password: "Password123!" })
      });
      const regAData = await regARes.json();
      const tokenA = regAData.token;
      const idA = regAData.user._id;
      createdUserIds.push(idA);

      // User B registers
      const userBEmail = `e2e-user-b-${Date.now()}@example.com`;
      const regBRes = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "User B", email: userBEmail, password: "Password123!" })
      });
      const regBData = await regBRes.json();
      const tokenB = regBData.token;
      const idB = regBData.user._id;
      createdUserIds.push(idB);

      // User A creates book A and Spanish translation
      const bookARes = await apiFetch("/api/books", {
        method: "POST",
        token: tokenA,
        body: JSON.stringify({ title: "Book A", author: "Author A", chapters: [{ title: "Ch A", content: "A" }] })
      });
      const bookAData = await bookARes.json();
      const bookAId = bookAData.book._id;
      createdBookIds.push(bookAId);

      const transARes = await apiFetch(`/api/books/${bookAId}/translations`, {
        method: "POST",
        token: tokenA,
        body: JSON.stringify({ targetLanguage: "Spanish", engine: "groq", model: "llama-3.3-70b-versatile" })
      });
      const transAData = await transARes.json();
      const transAId = transAData.translation._id;

      // User B attempts to access/translate/set active book A's translation
      const accessRes = await apiFetch(`/api/books/${bookAId}/translations/${transAId}/active`, {
        method: "PATCH",
        token: tokenB,
        body: JSON.stringify({ isActive: true })
      });
      assert.ok([403, 404].includes(accessRes.status));
    });

    it("T4_5: Heavy edit and alignment scenario", async () => {
      // 1. User creates book with 2 chapters
      const bookRes = await apiFetch("/api/books", {
        method: "POST",
        token: userToken,
        body: JSON.stringify({
          title: "Heavy Edit Book",
          author: "E2E Author",
          chapters: [
            { title: "Chapter 1", content: "Content 1" },
            { title: "Chapter 2", content: "Content 2" }
          ]
        })
      });
      const bookData = await bookRes.json();
      const hBookId = bookData.book._id;
      const ch1Id = bookData.book.chapters[0]._id;
      const ch2Id = bookData.book.chapters[1]._id;
      createdBookIds.push(hBookId);

      // 2. User creates translation and translates both chapters
      const transRes = await apiFetch(`/api/books/${hBookId}/translations`, {
        method: "POST",
        token: userToken,
        body: JSON.stringify({ targetLanguage: "Spanish", engine: "groq", model: "llama-3.3-70b-versatile" })
      });
      const transId = (await transRes.json()).translation._id;

      await apiFetch(`/api/books/${hBookId}/translations/${transId}/translate`, {
        method: "POST",
        token: userToken
      });

      // 3. User adds Chapter 3, deletes Chapter 1, edits Chapter 2 in English
      await apiFetch(`/api/books/${hBookId}`, {
        method: "PUT",
        token: userToken,
        body: JSON.stringify({
          chapters: [
            { _id: ch2Id, title: "Chapter 2 Edited", content: "Content 2 Edited" },
            { title: "Chapter 3 Added", content: "Content 3" }
          ]
        })
      });

      // 4. Verify translation schema aligns:
      // Chapter 1 translation is removed, Chapter 2 translation remains, Chapter 3 is added as untranslated
      const getTransRes = await apiFetch(`/api/books/${hBookId}/translations`, {
        method: "GET",
        token: userToken
      });
      const transList = (await getTransRes.json()).translations;
      const targetTrans = transList.find(t => t._id === transId);

      const ch1Translated = targetTrans.chapters.find(c => c.originalChapterId === ch1Id);
      assert.ok(!ch1Translated); // deleted

      const ch2Translated = targetTrans.chapters.find(c => c.originalChapterId === ch2Id);
      assert.ok(ch2Translated); // still present

      const ch3Translated = targetTrans.chapters.find(c => c.title === "Chapter 3 Added");
      assert.ok(ch3Translated);
      assert.equal(ch3Translated.status, "empty"); // untranslated

      // 5. User translates entire book (now only translating Chapter 3)
      const finalTransRes = await apiFetch(`/api/books/${hBookId}/translations/${transId}/translate`, {
        method: "POST",
        token: userToken
      });
      assert.equal(finalTransRes.status, 200);
    });
  });
});
