function normalizeBookType(value = "") {
  return String(value || "Nonfiction")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

function getBookTypeFamily(bookType = "") {
  const normalized = normalizeBookType(bookType);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");

  const fictionTypes = new Set([
    "novel",
    "noval",
    "novella",
    "fiction",
    "fantasy",
    "sci-fi",
    "sci fi",
    "science fiction",
    "romance",
    "thriller",
    "mystery",
    "horror",
    "literary fiction",
    "historical fiction",
    "young adult",
    "ya",
    "ya novel",
  ]);

  if (fictionTypes.has(normalized) || ["scifi", "yanovel"].includes(compact)) {
    return "fiction";
  }

  if (
    /\b(novel|noval|novella|fiction|fantasy|romance|thriller|mystery|horror)\b/.test(
      normalized
    )
  ) {
    return "fiction";
  }

  if (
    /\b(sci\s*fi|science fiction|young adult|ya novel)\b/.test(normalized)
  ) {
    return "fiction";
  }

  if (
    [
      "textbook",
      "text book",
      "school textbook",
      "college textbook",
      "academic textbook",
      "educational textbook",
      "course textbook",
    ].includes(normalized) ||
    ["textbook", "schooltextbook", "collegetextbook", "academictextbook"].includes(
      compact
    ) ||
    /\b(text\s*book|textbook)\b/.test(normalized)
  ) {
    return "textbook";
  }

  if (
    [
      "children's book",
      "children book",
      "childrens book",
      "kids book",
      "kids",
      "kid's book",
      "picture book",
      "storybook",
      "story book",
      "early reader",
    ].includes(normalized) ||
    [
      "childrensbook",
      "kidsbook",
      "kidsstorybook",
      "picturebook",
      "storybook",
      "earlyreader",
    ].includes(compact) ||
    /\b(children'?s?|kids?|picture|storybook|early reader)\b/.test(normalized)
  ) {
    return "children";
  }

  if (
    [
      "workbook",
      "work book",
      "worksheet",
      "worksheets",
      "activity book",
      "course",
      "study guide",
      "lesson book",
      "curriculum",
      "training manual",
      "journal",
      "planner",
    ].includes(normalized) ||
    [
      "workbook",
      "worksheet",
      "worksheets",
      "activitybook",
      "studyguide",
      "lessonbook",
      "trainingmanual",
    ].includes(compact) ||
    /\b(work\s*book|worksheet|activity book|study guide|lesson book|curriculum|course)\b/.test(
      normalized
    )
  ) {
    return "learning";
  }

  if (["technical"].includes(normalized)) {
    return "technical";
  }

  if (["how-to guide", "how to guide", "self-help", "business"].includes(normalized)) {
    return "practical";
  }

  if (["academic"].includes(normalized)) {
    return "academic";
  }

  return "nonfiction";
}

function getBookTypeOutlineGuidance(bookType = "") {
  const family = getBookTypeFamily(bookType);

  if (family === "fiction") {
    return [
      "Book type guidance:",
      "- Treat this as a real novel, not an explainer, guide, article collection, or lesson plan.",
      "- The structure must be story-driven chapters with named characters, scene goals, escalating conflict, reversals, character decisions, emotional consequences, and cliffhangers or hooks.",
      "- Each chapter brief must describe plot movement, setting, POV focus, character desire, obstacle, conflict, revelation, emotional turn, and the hook into the next chapter.",
      "- Build a complete narrative arc across the whole book: inciting incident, rising complications, midpoint turn, crisis, climax, and resolution.",
      "- Use evocative chapter titles that sound like fiction. Do not use numbered textbook hierarchy such as 1, 1.1, 1.2.3, modules, lessons, units, sections, or sub-sections.",
      "- Avoid chapter briefs that sound like essays, lessons, lectures, takeaways, generic sections, topic explainers, or nonfiction content blocks.",
    ].join("\n");
  }

  if (family === "children") {
    return [
      "Book type guidance:",
      "- Treat this as a children's storybook with clear scenes, warm language, memorable repetition, and age-appropriate conflict.",
      "- Structure the outline as two-page illustrated scenes, not extensive chapters, lessons, or essays.",
      "- Each editable unit becomes two individual PDF pages: an image page with a short story line under the illustration, followed by a text page with the rest of the read-aloud copy.",
      "- When the user requests a page count, plan one illustrated scene for every two interior pages; for example, 20 pages means 10 image pages and 10 text pages.",
      "- Each scene brief should include action, emotion, recurring characters, a single visual moment, and a simple story beat.",
      "- Avoid adult instructional tone unless the user explicitly asks for an educational workbook.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type guidance:",
      "- Treat this as an interactive learning product.",
      "- Structure chapters as modules with objectives, explanations, examples, exercises, reflection prompts, and practice tasks.",
      "- Include printable workbook space where useful: fill-in blanks, ruled answer lines, checkboxes, short response prompts, and practice tables.",
      "- Make every exercise self-contained enough for the reader to complete on the page.",
      "- Keep the outline practical and usable for a learner moving through the material.",
    ].join("\n");
  }

  if (family === "textbook") {
    return [
      "Book type guidance:",
      "- Treat this as a formal textbook, not a workbook, blog, article collection, or casual guide.",
      "- Structure the book as complete textbook chapters with teachable sequencing from foundations to advanced concepts.",
      "- Each chapter brief must include learning objectives, key terms, major concept sections, definitions, worked examples or case studies, figure/table opportunities, a chapter summary, and review questions.",
      "- Use clear pedagogical progression: introduce terms, explain concepts, demonstrate with examples, connect ideas, and assess understanding.",
      "- Avoid fill-in blanks and worksheet answer lines unless the user explicitly asks for a workbook.",
    ].join("\n");
  }

  if (family === "technical") {
    return [
      "Book type guidance:",
      "- Treat this as a technical book with accurate concepts, clear prerequisites, implementation detail, examples, tradeoffs, and troubleshooting.",
      "- Chapters should progress from foundations to practical application and advanced use.",
      "- Use code only when the topic genuinely requires source code, commands, or config.",
    ].join("\n");
  }

  if (family === "practical") {
    return [
      "Book type guidance:",
      "- Treat this as a practical guide with a clear reader outcome.",
      "- Chapters should teach usable steps, examples, decisions, common mistakes, and applied takeaways.",
      "- Keep the structure action-oriented rather than abstract.",
    ].join("\n");
  }

  if (family === "academic") {
    return [
      "Book type guidance:",
      "- Treat this as a rigorous academic-style book with definitions, context, theory, evidence, and careful argumentation.",
      "- Chapters should build a defensible line of reasoning and avoid unsupported claims.",
    ].join("\n");
  }

  return [
    "Book type guidance:",
    "- Treat this as a polished nonfiction ebook.",
    "- Chapters should build a coherent reader journey with clear explanations, examples, implications, and useful progression.",
  ].join("\n");
}

function getBookTypeChapterGuidance(bookType = "") {
  const family = getBookTypeFamily(bookType);

  if (family === "fiction") {
    return [
      "Book type guidance:",
      "- Write this as real novel prose, not nonfiction, not a guide, not an essay, not an explainer, and not a blog article.",
      "- Use immersive scene work: character action, dialogue, interiority, sensory detail, conflict, stakes, subtext, pacing, and narrative momentum.",
      "- Every chapter needs a dramatic engine: a character wants something, something blocks them, pressure increases, a choice is made, and the choice changes the situation.",
      "- Show character emotion through behavior, dialogue, body language, private thoughts, and choices instead of explaining lessons to the reader.",
      "- Keep POV, tense, voice, world rules, and character continuity consistent with the Book Bible.",
      "- Avoid instructional headings, summaries, key takeaways, exercises, blog tone, direct advice, abstract lectures, and topic-section structure unless they are diegetic inside the story world.",
    ].join("\n");
  }

  if (family === "children") {
    return [
      "Book type guidance:",
      "- Write as a children's storybook, not a nonfiction lesson, essay, or generic explainer.",
      "- Use storybook warmth, clear action, vivid imagery, age-appropriate vocabulary, repetition, rhythm, and a satisfying emotional beat.",
      "- Keep recurring character names, appearances, relationships, and personality traits consistent across pages.",
      "- Treat this unit as two individual children's-book pages: first an illustration page with a short story line under the image, then a text page with the rest of the read-aloud copy.",
      "- Return only the story manuscript text. Do not write 'Left Page' or 'Right Page' labels, illustration directions, image prompts, or art descriptions into the chapter content.",
      "- Keep the text concise enough to fit across the two pages; do not write an extensive chapter.",
      "- Avoid adult essay tone, key-takeaway sections, business language, and lesson-plan structure unless the user explicitly asked for an educational children's workbook.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type guidance:",
      "- Write this as a learning module with objectives, explanation, examples, exercises, reflection prompts, and practical assignments.",
      "- Use printable workbook formatting: fill-in-the-blank prompts, answer lines made from underscores, checkboxes written as [ ], short response spaces, and clear worksheet sections.",
      "- Do not let the prose become a passive textbook chapter; the reader should have places to write, decide, calculate, reflect, or practice.",
      "- Keep answer spaces readable in export by placing long fill-in lines on their own lines instead of burying them in dense paragraphs.",
      "- Make the reader able to do something concrete by the end.",
    ].join("\n");
  }

  if (family === "textbook") {
    return [
      "Book type guidance:",
      "- Write as a polished textbook chapter with a clear teaching sequence, not a blog post, generic ebook chapter, sales guide, or workbook.",
      "- Use textbook formatting in markdown: Learning Objectives, Key Terms, numbered concept sections, definitions, worked examples or cases, chapter summary, and review questions.",
      "- Define important terms when first introduced and keep terminology consistent.",
      "- Explain concepts from prerequisite knowledge toward more complex ideas, with transitions that show how each concept builds on the previous one.",
      "- Include examples, mini-cases, tables, or comparison lists where they improve comprehension, but do not invent citations or unsupported facts.",
      "- End with a concise chapter summary and review questions that test comprehension, application, and analysis.",
      "- Do not add fill-in blanks, ruled answer lines, or printable worksheet space unless the user explicitly requested a workbook.",
    ].join("\n");
  }

  if (family === "technical") {
    return [
      "Book type guidance:",
      "- Write precise technical instruction with accurate terminology, prerequisites, examples, tradeoffs, and troubleshooting.",
      "- Prefer clear prose, lists, tables, and code only when code/config/commands are genuinely required.",
    ].join("\n");
  }

  if (family === "practical") {
    return [
      "Book type guidance:",
      "- Write as a practical guide with steps, examples, reader decisions, mistakes to avoid, and concrete application.",
      "- Keep the chapter useful and outcome-driven.",
    ].join("\n");
  }

  if (family === "academic") {
    return [
      "Book type guidance:",
      "- Write in a rigorous academic style with clear definitions, context, evidence, counterpoints, and careful reasoning.",
      "- Avoid casual unsupported claims.",
    ].join("\n");
  }

  return [
    "Book type guidance:",
    "- Write polished nonfiction with coherent progression, concrete examples, and reader-focused clarity.",
  ].join("\n");
}

function getBookTypeImageGuidance(bookType = "") {
  const family = getBookTypeFamily(bookType);

  if (family === "fiction") {
    return [
      "Book type image guidance:",
      "- Treat visuals as narrative book art, not instructional graphics, business diagrams, or explainer images.",
      "- Depict a specific story moment with character emotion, atmosphere, setting, stakes, and cinematic composition.",
      "- For covers, make it feel like a shelf-ready fiction cover with mood, world, conflict, and shelf appeal.",
      "- Avoid generic writing, laptop, office, textbook, blog, or how-to imagery unless it is explicitly part of the story.",
    ].join("\n");
  }

  if (family === "children") {
    return [
      "Book type image guidance:",
      "- Treat visuals as warm children's book illustration with clear characters, expressive emotion, readable action, and age-appropriate charm.",
      "- Keep shapes, faces, and story moments easy to understand at a glance.",
      "- Preserve recurring character identity, wardrobe, proportions, colors, and personality cues across all illustrations.",
      "- For each image page, create the illustration that pairs with the short text under the image and the following text page.",
      "- Make each image a single clear story moment rather than a generic chapter poster.",
      "- Avoid adult editorial, corporate, or textbook styling.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type image guidance:",
      "- Treat visuals as friendly learning material: clear examples, exercises, tools, worksheets, or classroom/workshop context.",
      "- Make the image support practice and comprehension rather than decorative mood.",
      "- Avoid fake readable text inside generated images; worksheet labels, answer lines, and fill-in prompts should live in the manuscript text where export can render them cleanly.",
    ].join("\n");
  }

  if (family === "textbook") {
    return [
      "Book type image guidance:",
      "- Treat visuals as textbook publishing art: clean instructional figures, concept illustrations, process views, maps, timelines, lab/classroom scenes, or chapter-opening educational images.",
      "- Make visuals clarify the chapter concept rather than act as decorative mood art.",
      "- Avoid fake readable labels or dense text inside generated images; labels, captions, tables, and figure explanations should live in the manuscript text where export can render them cleanly.",
      "- Keep the tone credible, organized, and suitable for formal educational publishing.",
    ].join("\n");
  }

  if (family === "technical") {
    return [
      "Book type image guidance:",
      "- Treat visuals as polished technical publishing art: systems, architecture, interfaces, workflows, tools, or abstract technology concepts.",
      "- Prefer clean, precise, modern compositions. Avoid misleading fake UI text or unreadable labels inside the image.",
    ].join("\n");
  }

  if (family === "practical") {
    return [
      "Book type image guidance:",
      "- Treat visuals as practical guide imagery: reader transformation, real-world application, tools, decisions, habits, or outcomes.",
      "- Make the image useful, credible, and commercially polished rather than generic stock-photo filler.",
    ].join("\n");
  }

  if (family === "academic") {
    return [
      "Book type image guidance:",
      "- Treat visuals as serious academic or research publishing imagery: concepts, evidence, institutions, archives, models, or careful visual metaphor.",
      "- Keep the tone restrained, credible, and intellectually polished.",
    ].join("\n");
  }

  return [
    "Book type image guidance:",
    "- Treat visuals as polished nonfiction publishing art that clearly supports the book's subject and reader promise.",
    "- Avoid generic ebook, laptop, author, or stock-photo scenes unless the user explicitly asks for them.",
  ].join("\n");
}

function getDefaultChapterImageCount(bookType = "") {
  return 1;
}

function getChildrenSpreadCountFromPages(pageCount = 20) {
  const parsed = Number.parseInt(pageCount, 10);
  const safePageCount = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 2), 52)
    : 20;

  return Math.min(Math.max(Math.ceil(safePageCount / 2), 1), 26);
}

function getBookTypeStructureCount(bookType = "", requestedCount = 8) {
  const family = getBookTypeFamily(bookType);

  if (family === "children") {
    return getChildrenSpreadCountFromPages(requestedCount);
  }

  const parsed = Number.parseInt(requestedCount, 10);

  return Math.min(Math.max(parsed || 8, 1), 26);
}

module.exports = {
  getDefaultChapterImageCount,
  getBookTypeStructureCount,
  getChildrenSpreadCountFromPages,
  getBookTypeChapterGuidance,
  getBookTypeFamily,
  getBookTypeImageGuidance,
  getBookTypeOutlineGuidance,
};
