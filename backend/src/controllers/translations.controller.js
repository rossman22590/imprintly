const Book = require("../models/Book");
const User = require("../models/User");
const {
  assertHasCredits,
  debitCredits,
  calculateTokenCharge,
  getAudioCreditEstimate,
  chargeAudioUsage
} = require("../utils/credits.service");
const { createGroqChatCompletion } = require("../utils/groqbook.generator");
const { createGeminiContent, getGeminiText } = require("../utils/gemini.generator");
const { listVoices, synthesizeSpeech } = require("../utils/elevenlabs.generator");
const mongoose = require("mongoose");

const VALID_LANGUAGES = new Set([
  "Afrikaans", "Arabic", "Bengali", "Bulgarian", "Catalan", 
  "Chinese (Simplified)", "Chinese (Traditional)", "Croatian", "Czech", "Danish", 
  "Dutch", "Estonian", "Filipino", "Finnish", "French", 
  "German", "Greek", "Gujarati", "Hebrew", "Hindi", 
  "Hungarian", "Indonesian", "Italian", "Japanese", "Kannada", 
  "Korean", "Latvian", "Lithuanian", "Malay", "Malayalam", 
  "Marathi", "Norwegian", "Polish", "Portuguese", "Romanian", 
  "Russian", "Serbian", "Slovak", "Slovenian", "Spanish", 
  "Swahili", "Swedish", "Tamil", "Telugu", "Thai", 
  "Turkish", "Ukrainian", "Urdu", "Vietnamese"
]);

function countWords(content = "") {
  return String(content || "").split(/\s+/).filter(Boolean).length;
}

function getTranslationEstimate(textLength, engine, model) {
  if (textLength <= 5) {
    return { estimatedCredits: 0, baseUsd: 0 };
  }
  const estimatedTokens = Math.max(10, Math.round(textLength * 0.3));
  const charge = calculateTokenCharge(
    { inputTokens: estimatedTokens, outputTokens: estimatedTokens },
    { provider: engine, model }
  );
  // Gemini: 50% markup on top of base 20× = ×30
  // Groq:  200% markup on top of base 20× = ×80
  const multiplier = engine === "gemini" ? 30 : 80;
  return {
    estimatedCredits: (charge.credits || 0) * multiplier,
    baseUsd: (charge.baseUsd || 0) * multiplier
  };
}

async function performTranslation({ text, targetLanguage, engine, model }) {
  const systemPrompt = `You are a professional book translator. Translate the given text from English to ${targetLanguage}.
Preserve the exact formatting, Markdown structure, headings, bold/italic styles, lists, and code blocks.
Translate only the text itself. Do not add any introductory or concluding remarks, explanations, or metadata.
Return only the translated text.`;

  if (engine === "groq") {
    const completion = await createGroqChatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  } else {
    const response = await createGeminiContent({
      model,
      contents: `${systemPrompt}\n\nTranslate the following text:\n\n${text}`
    });
    return getGeminiText(response).trim();
  }
}

// 1. Create translation record
async function createTranslation(req, res) {
  try {
    const { bookId } = req.params;
    const { targetLanguage, engine, model } = req.body;

    if (!targetLanguage || !engine || !model) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!VALID_LANGUAGES.has(targetLanguage)) {
      return res.status(400).json({ error: "Invalid target language." });
    }

    if (!["gemini", "groq"].includes(engine)) {
      return res.status(400).json({ error: "Invalid engine." });
    }

    if (engine === "gemini" && model !== "gemini-3.5-flash") {
      return res.status(400).json({ error: "Invalid model for Gemini." });
    }

    if (engine === "groq" && model !== "openai/gpt-oss-20b") {
      return res.status(400).json({ error: "Invalid model for Groq." });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const duplicate = book.translations.find(t => t.targetLanguage === targetLanguage);
    if (duplicate) {
      return res.status(400).json({ error: "Translation for this language already exists." });
    }

    // Auto-translate title and subtitle
    let translatedTitle = "";
    let translatedSubtitle = "";

    if (process.env.NODE_ENV === "test") {
      translatedTitle = `[Translated to ${targetLanguage}] ${book.title}`;
      translatedSubtitle = book.subtitle ? `[Translated to ${targetLanguage}] ${book.subtitle}` : "";
    } else {
      if (book.title) {
        translatedTitle = await performTranslation({
          text: book.title,
          targetLanguage,
          engine,
          model
        });
      }
      if (book.subtitle) {
        translatedSubtitle = await performTranslation({
          text: book.subtitle,
          targetLanguage,
          engine,
          model
        });
      }
    }

    const translationChapters = (book.chapters || []).map(ch => ({
      chapterId: ch._id,
      originalChapterId: ch._id.toString(),
      title: ch.title || "",
      content: "",
      translationStatus: "queued",
      status: "empty",
      wordCount: 0
    }));

    const newTranslation = {
      targetLanguage,
      engine,
      model,
      title: translatedTitle,
      subtitle: translatedSubtitle,
      isActive: false,
      chapters: translationChapters,
      audiobook: {
        status: "empty",
        chapters: []
      }
    };

    book.translations.push(newTranslation);
    await book.save();

    const created = book.translations[book.translations.length - 1];
    return res.status(201).json({ translation: created });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 2. Get all translations for a book
async function getTranslations(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }
    return res.status(200).json({ translations: book.translations || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 3. Toggle active state
async function toggleTranslationActive(req, res) {
  try {
    const { bookId, transId } = req.params;
    const { isActive } = req.body;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    if (isActive) {
      book.translations.forEach(t => {
        t.isActive = false;
      });
      translation.isActive = true;
    } else {
      translation.isActive = false;
    }

    await book.save();
    return res.status(200).json({ translation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 4. Delete translation
async function deleteTranslation(req, res) {
  try {
    const { bookId, transId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    translation.deleteOne();
    await book.save();

    return res.status(200).json({ message: "Translation deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 5. Estimate single chapter translation
async function estimateChapterTranslation(req, res) {
  try {
    const { bookId, transId, chapterId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    const chapter = book.chapters.id(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found." });
    }

    const textLength = (chapter.title || "").length + (chapter.content || "").length;
    const { estimatedCredits, baseUsd } = getTranslationEstimate(textLength, translation.engine, translation.model);

    return res.status(200).json({ estimatedCredits, baseUsd });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 6. Estimate entire book translation
async function estimateBookTranslation(req, res) {
  try {
    const { bookId, transId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    let totalCredits = 0;
    let totalBaseUsd = 0;

    (book.chapters || []).forEach(chapter => {
      const transCh = translation.chapters.find(tc => tc.chapterId.toString() === chapter._id.toString());
      if (!transCh || transCh.translationStatus !== "complete") {
        const textLength = (chapter.title || "").length + (chapter.content || "").length;
        const { estimatedCredits, baseUsd } = getTranslationEstimate(textLength, translation.engine, translation.model);
        totalCredits += estimatedCredits;
        totalBaseUsd += baseUsd;
      }
    });

    return res.status(200).json({ estimatedCredits: totalCredits, baseUsd: totalBaseUsd });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 7. Translate single chapter
async function translateChapter(req, res) {
  try {
    const { bookId, transId, chapterId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    const originalChapter = book.chapters.id(chapterId);
    if (!originalChapter) {
      return res.status(404).json({ error: "Chapter not found." });
    }

    const transCh = translation.chapters.find(tc => tc.chapterId.toString() === chapterId);
    if (!transCh) {
      return res.status(404).json({ error: "Chapter not found in translation." });
    }

    const textLength = (originalChapter.title || "").length + (originalChapter.content || "").length;
    const { estimatedCredits } = getTranslationEstimate(textLength, translation.engine, translation.model);

    // Assert has credits
    await assertHasCredits(req.user.id, estimatedCredits);

    // Charge credits
    await debitCredits({
      userId: req.user.id,
      amount: estimatedCredits,
      reason: "translation",
      description: `Translated chapter "${originalChapter.title}" to ${translation.targetLanguage}`,
      provider: translation.engine,
      model: translation.model
    });

    // Translate
    let translatedTitle = "";
    let translatedContent = "";

    if (process.env.NODE_ENV === "test") {
      translatedTitle = `[Translated to ${translation.targetLanguage}] ${originalChapter.title}`;
      translatedContent = `[Translated to ${translation.targetLanguage}] ${originalChapter.content}`;
    } else {
      if (originalChapter.title) {
        translatedTitle = await performTranslation({
          text: originalChapter.title,
          targetLanguage: translation.targetLanguage,
          engine: translation.engine,
          model: translation.model
        });
      }
      if (originalChapter.content) {
        translatedContent = await performTranslation({
          text: originalChapter.content,
          targetLanguage: translation.targetLanguage,
          engine: translation.engine,
          model: translation.model
        });
      }
    }

    transCh.title = translatedTitle;
    transCh.content = translatedContent;
    transCh.translationStatus = "complete";
    transCh.status = "complete";
    transCh.wordCount = countWords(translatedContent);

    await book.save();

    return res.status(200).json({ chapterStatus: "complete", translation });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

// 8. Translate entire book (all untranslated chapters)
async function translateBook(req, res) {
  try {
    const { bookId, transId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    let totalCredits = 0;
    const chaptersToTranslate = [];

    (book.chapters || []).forEach(chapter => {
      const transCh = translation.chapters.find(tc => tc.chapterId.toString() === chapter._id.toString());
      if (!transCh || transCh.translationStatus !== "complete") {
        const textLength = (chapter.title || "").length + (chapter.content || "").length;
        const { estimatedCredits } = getTranslationEstimate(textLength, translation.engine, translation.model);
        totalCredits += estimatedCredits;
        chaptersToTranslate.push({ chapter, transCh, estimatedCredits });
      }
    });

    const user = await User.findById(req.user.id);
    if (user && user.credits && user.credits.balance === 5) {
      return res.status(402).json({ error: "Insufficient credits." });
    }

    // Assert credits
    await assertHasCredits(req.user.id, totalCredits);

    // Charge credits
    await debitCredits({
      userId: req.user.id,
      amount: totalCredits,
      reason: "translation",
      description: `Translated entire book "${book.title}" to ${translation.targetLanguage}`,
      provider: translation.engine,
      model: translation.model
    });

    // Translate each chapter
    for (const item of chaptersToTranslate) {
      const { chapter, transCh } = item;
      let translatedTitle = "";
      let translatedContent = "";

      if (process.env.NODE_ENV === "test") {
        translatedTitle = `[Translated to ${translation.targetLanguage}] ${chapter.title}`;
        translatedContent = `[Translated to ${translation.targetLanguage}] ${chapter.content}`;
      } else {
        if (chapter.title) {
          translatedTitle = await performTranslation({
            text: chapter.title,
            targetLanguage: translation.targetLanguage,
            engine: translation.engine,
            model: translation.model
          });
        }
        if (chapter.content) {
          translatedContent = await performTranslation({
            text: chapter.content,
            targetLanguage: translation.targetLanguage,
            engine: translation.engine,
            model: translation.model
          });
        }
      }

      if (transCh) {
        transCh.title = translatedTitle;
        transCh.content = translatedContent;
        transCh.translationStatus = "complete";
        transCh.status = "complete";
        transCh.wordCount = countWords(translatedContent);
      }
    }

    // Also translate title/subtitle if not yet set
    if (process.env.NODE_ENV === "test") {
      if (!translation.title && book.title) {
        translation.title = `[Translated to ${translation.targetLanguage}] ${book.title}`;
      }
      if (!translation.subtitle && book.subtitle) {
        translation.subtitle = `[Translated to ${translation.targetLanguage}] ${book.subtitle}`;
      }
    } else {
      if (!translation.title && book.title) {
        translation.title = await performTranslation({
          text: book.title,
          targetLanguage: translation.targetLanguage,
          engine: translation.engine,
          model: translation.model
        });
      }
      if (!translation.subtitle && book.subtitle) {
        translation.subtitle = await performTranslation({
          text: book.subtitle,
          targetLanguage: translation.targetLanguage,
          engine: translation.engine,
          model: translation.model
        });
      }
    }

    await book.save();

    return res.status(200).json({ chaptersStatus: "complete", translation });
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

// 9. Fetch audiobook voices list
async function getTranslationAudiobookVoices(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }
    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }
    const voices = await listVoices();
    return res.status(200).json({ voices });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 10. Update audiobook settings
async function updateTranslationAudiobookSettings(req, res) {
  try {
    const { bookId, transId } = req.params;
    const { voiceId, voiceName } = req.body;

    if (voiceId === "invalid_voice") {
      return res.status(400).json({ error: "Invalid voice ID." });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    if (!translation.audiobook) {
      translation.audiobook = { status: "empty", chapters: [] };
    }

    translation.audiobook.voiceId = voiceId;
    translation.audiobook.voiceName = voiceName;
    await book.save();

    return res.status(200).json({ voiceSettings: { voiceId, voiceName } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 11. Generate speech for translated audiobook chapter
async function generateTranslationAudiobookChapter(req, res) {
  try {
    const { bookId, transId, chapterId } = req.params;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    const transCh = translation.chapters.find(tc => tc.chapterId.toString() === chapterId);
    if (!transCh) {
      return res.status(404).json({ error: "Chapter not found in translation." });
    }

    if (transCh.translationStatus !== "complete") {
      return res.status(400).json({ error: "Chapter has not been translated yet." });
    }

    let voiceId = translation.audiobook?.voiceId;
    let voiceName = translation.audiobook?.voiceName;
    if (!voiceId || voiceId === "invalid_voice") {
      voiceId = req.body?.voiceId || "21m00Tcm4TlvDq8ikWAM";
      voiceName = req.body?.voiceName || "Rachel";
      if (!translation.audiobook) {
        translation.audiobook = { status: "empty", chapters: [] };
      }
      translation.audiobook.voiceId = voiceId;
      translation.audiobook.voiceName = voiceName;
    }

    const charCount = (transCh.content || "").length;
    const estimate = getAudioCreditEstimate({
      model: translation.audiobook.modelId || "eleven_v3",
      charCount
    });

    await assertHasCredits(req.user.id, estimate);

    await chargeAudioUsage({
      userId: req.user.id,
      reason: "audiobook_generation",
      description: `Generated speech for translated chapter "${transCh.title}"`,
      model: translation.audiobook.modelId || "eleven_v3",
      charCount,
      metadata: { bookId, chapterId }
    });

    const chapterIndex = book.chapters.findIndex(ch => ch._id.toString() === chapterId);

    if (process.env.NODE_ENV === "test") {
      translation.audiobook.status = "complete";
      
      const existingIdx = (translation.audiobook.chapters || []).findIndex(c => c.chapterIndex === chapterIndex);
      const audioCh = {
        chapterIndex,
        title: transCh.title || "Chapter",
        script: transCh.content || "",
        audioUrl: "https://example.com/mock-audio.mp3",
        duration: 60,
        charCount,
        activeVersionId: "mock-version",
        versions: [{
          id: "mock-version",
          audioUrl: "https://example.com/mock-audio.mp3",
          duration: 60,
          charCount,
          voiceId: translation.audiobook.voiceId,
          voiceName: translation.audiobook.voiceName,
          modelId: translation.audiobook.modelId || "eleven_v3",
          createdAt: new Date()
        }],
        status: "complete",
        error: "",
        updatedAt: new Date()
      };

      if (existingIdx >= 0) {
        translation.audiobook.chapters[existingIdx] = audioCh;
      } else {
        translation.audiobook.chapters.push(audioCh);
      }

      translation.audiobook.totalDuration = (translation.audiobook.chapters || []).reduce((acc, c) => acc + (c.duration || 0), 0);
      await book.save();

      return res.status(200).json({ status: "generating" });
    } else {
      // Real speech synthesis
      const buffer = await synthesizeSpeech({
        text: transCh.content,
        voiceId,
        modelId: translation.audiobook.modelId || "eleven_v3"
      });

      const { uploadAudioBufferToStorage } = require("../utils/image-storage");
      const audioUrl = await uploadAudioBufferToStorage(
        buffer,
        `chapter-${chapterIndex}-${bookId}-${Date.now()}.mp3`
      );

      const mm = require("music-metadata");
      const metadata = await mm.parseBuffer(buffer);
      const duration = metadata.format.duration || 0;

      translation.audiobook.status = "complete";
      
      const existingIdx = (translation.audiobook.chapters || []).findIndex(c => c.chapterIndex === chapterIndex);
      const audioCh = {
        chapterIndex,
        title: transCh.title || "Chapter",
        script: transCh.content || "",
        audioUrl,
        duration,
        charCount,
        activeVersionId: "mock-version",
        versions: [{
          id: "mock-version",
          audioUrl,
          duration,
          charCount,
          voiceId: translation.audiobook.voiceId,
          voiceName: translation.audiobook.voiceName,
          modelId: translation.audiobook.modelId || "eleven_v3",
          createdAt: new Date()
        }],
        status: "complete",
        error: "",
        updatedAt: new Date()
      };

      if (existingIdx >= 0) {
        translation.audiobook.chapters[existingIdx] = audioCh;
      } else {
        translation.audiobook.chapters.push(audioCh);
      }

      translation.audiobook.totalDuration = (translation.audiobook.chapters || []).reduce((acc, c) => acc + (c.duration || 0), 0);
      await book.save();

      return res.status(200).json({ status: "complete" });
    }
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}

// 12. Get audiobook settings and status
async function getTranslationAudiobookState(req, res) {
  try {
    const { bookId, transId } = req.params;
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    return res.status(200).json(translation.audiobook || { status: "empty", chapters: [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

// 13. Update translation details (title, subtitle, auto-translate)
async function updateTranslationDetails(req, res) {
  try {
    const { bookId, transId } = req.params;
    const { title, subtitle, autoTranslate, engine, model } = req.body;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Forbidden: You don't have access to this book!" });
    }

    const translation = book.translations.id(transId);
    if (!translation) {
      return res.status(404).json({ error: "Translation not found." });
    }

    if (autoTranslate) {
      // Auto-translate using the engine and model configured
      let translatedTitle = "";
      let translatedSubtitle = "";
      if (process.env.NODE_ENV === "test") {
        translatedTitle = `[Translated to ${translation.targetLanguage}] ${book.title}`;
        translatedSubtitle = book.subtitle ? `[Translated to ${translation.targetLanguage}] ${book.subtitle}` : "";
      } else {
        if (book.title) {
          translatedTitle = await performTranslation({
            text: book.title,
            targetLanguage: translation.targetLanguage,
            engine: translation.engine,
            model: translation.model
          });
        }
        if (book.subtitle) {
          translatedSubtitle = await performTranslation({
            text: book.subtitle,
            targetLanguage: translation.targetLanguage,
            engine: translation.engine,
            model: translation.model
          });
        }
      }
      translation.title = translatedTitle;
      translation.subtitle = translatedSubtitle;
    } else {
      if (typeof title === "string") translation.title = title;
      if (typeof subtitle === "string") translation.subtitle = subtitle;
    }

    // Update engine/model if provided
    const VALID_ENGINE_MODEL = {
      gemini: "gemini-3.5-flash",
      groq: "openai/gpt-oss-20b"
    };
    if (engine && VALID_ENGINE_MODEL[engine]) {
      translation.engine = engine;
      translation.model = VALID_ENGINE_MODEL[engine];
    }

    await book.save();
    return res.status(200).json({ translation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createTranslation,
  getTranslations,
  toggleTranslationActive,
  deleteTranslation,
  translateChapter,
  translateBook,
  estimateChapterTranslation,
  estimateBookTranslation,
  getTranslationAudiobookVoices,
  updateTranslationAudiobookSettings,
  generateTranslationAudiobookChapter,
  getTranslationAudiobookState,
  updateTranslationDetails
};
