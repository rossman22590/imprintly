const ENV = require("../configs/env");
const {
  createGroqChatCompletion,
  getGroqModels,
  normalizeUsageStats,
} = require("./groqbook.generator");
const { runGeminiEditorialTask } = require("./gemini.generator");
const { normalizeBookBiblePayload, serializeBookBible } = require("./book-bible");
const { getBookTypeFamily } = require("./book-type-guidance");

const BIBLE_JSON_SHAPE =
  '{"characters":"","locations":"","worldRules":"","timeline":"","styleGuide":"","canonFacts":"","unresolvedThreads":"","notes":""}';

function cleanModelText(value = "") {
  return String(value || "")
    .trim()
    .replace(/^```(?:json|markdown|md)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonFromText(text = "") {
  const cleaned = cleanModelText(text);

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    const startCandidates = [firstBrace, firstBracket].filter(
      (index) => index >= 0
    );
    const start = Math.min(...startCandidates);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));

    if (!Number.isFinite(start) || end <= start) {
      throw new Error("Editorial response did not contain valid JSON.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function getGraphicsPolicy(includeTextGraphics = false) {
  if (includeTextGraphics) {
    return [
      "Graphics button is enabled.",
      "Use text graphics only when the chapter brief or user request clearly asks for them.",
      "Prefer normal markdown tables, numbered lists, comparison grids, or short labeled sections.",
      "Do not create ASCII art, box-drawing diagrams, pipe/dash flowcharts, Mermaid, graph code blocks, or fake diagram blocks unless the chapter brief explicitly asks for an ASCII diagram.",
    ].join(" ");
  }

  return [
    "Graphics button is disabled.",
    "Do not include charts, graphs, diagrams, flowcharts, visual explainers, ASCII art, box-drawing diagrams, Mermaid, graph code blocks, or diagram code blocks.",
    "Use prose, headings, and simple bullets instead.",
  ].join(" ");
}

function getEditorialBookTypeRules(genre = "") {
  const family = getBookTypeFamily(genre);

  if (family === "children") {
    return [
      "Children's picture-book rules:",
      "Treat each generated section as one illustrated scene, not a long prose chapter.",
      "Keep only final story prose. Do not output labels such as Left Page, Right Page, Story Text, Illustration Prompt, Art Notes, Image Prompt, or production direction.",
      "The opening 45-80 words should work as the short paragraph under the image page.",
      "The remaining story text should be fuller read-aloud prose, roughly twice the image-page text when enough content exists.",
      "Use clear character continuity, age-appropriate language, sensory action, playful rhythm, and a gentle page-turn hook.",
    ].join(" ");
  }

  if (family === "workbook") {
    return [
      "Workbook rules:",
      "Preserve worksheet structure, fill-in blanks, ruled answer lines, checkboxes, short prompts, examples, practice tasks, answer spaces, and printable formatting.",
      "Do not rewrite workbook material into passive textbook chapters unless the user explicitly asked for a textbook.",
    ].join(" ");
  }

  if (family === "textbook") {
    return [
      "Textbook rules:",
      "Write like a real textbook chapter with learning objectives, key terms, concept sections, examples or case studies, chapter summary, and review questions.",
      "Do not add workbook-style blanks or answer lines unless the user explicitly asked for exercises.",
    ].join(" ");
  }

  return "";
}

function summarizeCompletedChapter(chapter = {}, index = 0) {
  const title = chapter.title || `Chapter ${index + 1}`;
  const memory = cleanModelText(
    chapter.generationStats?.editorialMemory || chapter.editorialMemory || ""
  );

  if (memory) {
    return `Chapter ${index + 1}: ${title}\n${memory}`;
  }

  const excerpt = cleanModelText(chapter.content || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 900);

  return excerpt ? `Chapter ${index + 1}: ${title}\n- Existing content: ${excerpt}` : "";
}

function buildEnhancedBookContext({
  title,
  genre,
  audience,
  chapters = [],
  completedChapters = [],
}) {
  const chapterList = chapters
    .map(
      (chapter, index) =>
        `${index + 1}. ${chapter.title}: ${chapter.description || ""}`
    )
    .join("\n");
  const completedMemory = completedChapters
    .map(summarizeCompletedChapter)
    .filter(Boolean)
    .slice(-6)
    .join("\n\n");
  const lastCompleted = [...completedChapters]
    .reverse()
    .find((chapter) => String(chapter?.content || "").trim());
  const lastChapterState = lastCompleted
    ? summarizeCompletedChapter(lastCompleted, completedChapters.indexOf(lastCompleted))
    : "";

  return [
    `Book title: ${title}`,
    `Genre: ${genre}`,
    `Audience: ${audience}`,
    "Planned book outline:",
    chapterList || "No outline provided.",
    completedMemory
      ? `\nPrior chapter memory and continuity state:\n${completedMemory}`
      : "",
    lastChapterState
      ? `\nImmediate previous chapter state to carry forward:\n${lastChapterState}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildChapterCritiquePrompt({
  bookTitle,
  genre,
  audience,
  chapterTitle,
  chapterDescription,
  bookContext,
  bookBible,
  draftContent,
  includeTextGraphics,
}) {
  return `You are a senior book editor reviewing one drafted chapter before publication.

Book title: ${bookTitle}
Genre: ${genre}
Audience: ${audience}
Chapter title: ${chapterTitle}
Chapter brief: ${chapterDescription || "Not provided."}

Book context:
${bookContext}

Book Bible / canon:
${bookBible || "Not provided."}

Graphics policy:
${getGraphicsPolicy(includeTextGraphics)}

Book-type rules:
${getEditorialBookTypeRules(genre) || "Use the expected structure and reader experience for this book type."}

Review the draft for:
- weak or generic writing
- missing reader promise or chapter thesis
- missing concrete examples, scenarios, case studies, objections, consequences, or next-step value
- continuity errors against prior chapters or the Book Bible
- fiction problems: weak scene goal, low conflict, POV drift, missing emotional consequence, missing hook
- nonfiction problems: unsupported claims, vague advice, invented citations, thin examples, missing caveats, weak source discipline
- book-type problems: children scene labels/art notes, missing workbook answer spaces, or missing textbook structure
- accidental ASCII diagrams or visual blocks that violate the graphics policy

Return concise editorial notes only. Do not rewrite yet.

<draft>
${draftContent}
</draft>`;
}

function buildChapterRewritePrompt({
  bookTitle,
  genre,
  audience,
  chapterTitle,
  chapterDescription,
  bookContext,
  bookBible,
  draftContent,
  critique,
  includeTextGraphics,
}) {
  return `You are a senior book editor rewriting a drafted chapter into the best publishable version.

Book title: ${bookTitle}
Genre: ${genre}
Audience: ${audience}
Chapter title: ${chapterTitle}
Chapter brief: ${chapterDescription || "Not provided."}

Book context:
${bookContext}

Book Bible / canon:
${bookBible || "Not provided."}

Editorial critique to fix:
${critique || "Improve clarity, specificity, continuity, and publishing polish."}

Graphics policy:
${getGraphicsPolicy(includeTextGraphics)}

Book-type rules:
${getEditorialBookTypeRules(genre) || "Use the expected structure and reader experience for this book type."}

Rewrite rules:
1. Return only the revised chapter markdown.
2. Preserve the chapter's purpose while making it more specific, coherent, and premium.
3. Strengthen continuity with prior chapters and the Book Bible.
4. For nonfiction, make the chapter less generic: use a clear thesis, reader promise, concrete scenarios, examples, objections, caveats, consequences, and practical next steps. Do not invent citations. If a claim needs sourcing, phrase it carefully instead of fabricating proof.
5. For fiction, strengthen scene goals, conflict, choices, subtext, emotional consequence, and the hook into the next chapter.
6. Follow the graphics policy exactly.
7. Follow the book-type rules exactly.

<draft>
${draftContent}
</draft>`;
}

function buildBookBibleUpdatePrompt({
  bookTitle,
  genre,
  audience,
  existingBookBible,
  chapterTitle,
  chapterContent,
}) {
  return `You maintain a Book Bible for a generated book. Merge this new chapter into the existing canon.

Return only valid JSON with this exact shape:
${BIBLE_JSON_SHAPE}

Book title: ${bookTitle}
Genre: ${genre}
Audience: ${audience}

Existing Book Bible:
${serializeBookBible(existingBookBible) || "Not provided."}

Chapter title: ${chapterTitle}

Update rules:
1. Preserve existing canon unless the new chapter clearly corrects it.
2. Add newly established characters, aliases, relationships, motivations, secrets, locations, world rules, timeline events, style rules, canon facts, promises, and unresolved threads.
3. Track the final state at the end of the chapter so the next chapter can continue cleanly.
4. For nonfiction, track thesis, reader promise, key claims, examples/case studies used, caveats, open loops, source-sensitive claims, and practical outcomes.
5. Values must be strings using concise markdown bullets.

<chapter>
${chapterContent}
</chapter>`;
}

function buildChapterMemoryPrompt({
  bookTitle,
  genre,
  audience,
  chapterTitle,
  chapterContent,
}) {
  return `Create compact continuity memory for the next chapter.

Book title: ${bookTitle}
Genre: ${genre}
Audience: ${audience}
Chapter title: ${chapterTitle}

Return 5-9 concise markdown bullets covering:
- what changed in this chapter
- final character/location/state at the end
- unresolved threads or promises
- important facts, examples, claims, or decisions the next chapter must not contradict
- last-scene or last-argument momentum

<chapter>
${chapterContent}
</chapter>`;
}

async function runProviderEditorialTask({
  provider,
  prompt,
  modelPayload = {},
  responseFormat,
  maxCompletionTokens,
}) {
  if (provider === "gemini") {
    return runGeminiEditorialTask(prompt);
  }

  const { sectionModel } = getGroqModels(modelPayload);
  const completion = await createGroqChatCompletion({
    model: sectionModel,
    messages: [
      {
        role: "system",
        content:
          "You are a careful senior book editor. Follow the requested task exactly.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.25,
    maxCompletionTokens:
      maxCompletionTokens || Number(ENV.GROQ_SECTION_MAX_TOKENS || 9000),
    responseFormat,
  });

  return {
    content: completion.choices?.[0]?.message?.content?.trim() || "",
    stats: normalizeUsageStats(completion.usage, sectionModel),
    modelName: sectionModel,
  };
}

async function runPremiumChapterPipeline({
  provider,
  modelPayload = {},
  bookTitle,
  genre,
  audience,
  chapterTitle,
  chapterDescription,
  bookContext,
  bookBible = {},
  draftContent,
  includeTextGraphics = false,
}) {
  const steps = [];
  const errors = [];
  let content = cleanModelText(draftContent);
  let critique = "";
  let editorialMemory = "";
  let updatedBookBible = normalizeBookBiblePayload(bookBible);

  try {
    const critiqueResult = await runProviderEditorialTask({
      provider,
      modelPayload,
      prompt: buildChapterCritiquePrompt({
        bookTitle,
        genre,
        audience,
        chapterTitle,
        chapterDescription,
        bookContext,
        bookBible: serializeBookBible(updatedBookBible),
        draftContent: content,
        includeTextGraphics,
      }),
    });

    critique = cleanModelText(critiqueResult.content);
    steps.push({ action: "chapter_editorial_critique", result: critiqueResult });
  } catch (error) {
    errors.push(`critique: ${error.message}`);
  }

  try {
    const rewriteResult = await runProviderEditorialTask({
      provider,
      modelPayload,
      prompt: buildChapterRewritePrompt({
        bookTitle,
        genre,
        audience,
        chapterTitle,
        chapterDescription,
        bookContext,
        bookBible: serializeBookBible(updatedBookBible),
        draftContent: content,
        critique,
        includeTextGraphics,
      }),
    });
    const revisedContent = cleanModelText(rewriteResult.content);

    if (revisedContent.length >= 100) {
      content = revisedContent;
    } else {
      errors.push("rewrite: revised chapter was too short");
    }

    steps.push({ action: "chapter_editorial_rewrite", result: rewriteResult });
  } catch (error) {
    errors.push(`rewrite: ${error.message}`);
  }

  try {
    const bibleResult = await runProviderEditorialTask({
      provider,
      modelPayload,
      responseFormat: provider === "groq" ? { type: "json_object" } : undefined,
      prompt: buildBookBibleUpdatePrompt({
        bookTitle,
        genre,
        audience,
        existingBookBible: updatedBookBible,
        chapterTitle,
        chapterContent: content,
      }),
    });
    const parsedBible = parseJsonFromText(bibleResult.content);

    updatedBookBible = normalizeBookBiblePayload(parsedBible);
    steps.push({ action: "book_bible_update", result: bibleResult });
  } catch (error) {
    errors.push(`book_bible_update: ${error.message}`);
  }

  try {
    const memoryResult = await runProviderEditorialTask({
      provider,
      modelPayload,
      maxCompletionTokens: 1600,
      prompt: buildChapterMemoryPrompt({
        bookTitle,
        genre,
        audience,
        chapterTitle,
        chapterContent: content,
      }),
    });

    editorialMemory = cleanModelText(memoryResult.content).slice(0, 2500);
    steps.push({ action: "chapter_memory_update", result: memoryResult });
  } catch (error) {
    errors.push(`chapter_memory_update: ${error.message}`);
  }

  return {
    content,
    critique,
    editorialMemory,
    bookBible: updatedBookBible,
    errors,
    steps,
  };
}

module.exports = {
  buildEnhancedBookContext,
  getGraphicsPolicy,
  runPremiumChapterPipeline,
};
