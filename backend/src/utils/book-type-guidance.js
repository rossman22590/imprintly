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

  if (["children's book", "children book", "kids book", "kids"].includes(normalized)) {
    return "children";
  }

  if (["workbook", "course"].includes(normalized)) {
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
      "- Each chapter or spread brief should include action, emotion, visual moments, and a simple story beat.",
      "- Avoid adult instructional tone unless the user explicitly asks for an educational workbook.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type guidance:",
      "- Treat this as an interactive learning product.",
      "- Structure chapters as modules with objectives, explanations, examples, exercises, reflection prompts, and practice tasks.",
      "- Keep the outline practical and usable for a learner moving through the material.",
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
      "- Write with storybook warmth, clear action, vivid imagery, age-appropriate vocabulary, and a satisfying emotional beat.",
      "- Use repetition and rhythm when helpful, but keep the chapter moving as a story.",
      "- Avoid adult essay tone.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type guidance:",
      "- Write this as a learning module with objectives, explanation, examples, exercises, reflection prompts, and practical assignments.",
      "- Make the reader able to do something concrete by the end.",
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
      "- Avoid adult editorial, corporate, or textbook styling.",
    ].join("\n");
  }

  if (family === "learning") {
    return [
      "Book type image guidance:",
      "- Treat visuals as friendly learning material: clear examples, exercises, tools, worksheets, or classroom/workshop context.",
      "- Make the image support practice and comprehension rather than decorative mood.",
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

module.exports = {
  getBookTypeChapterGuidance,
  getBookTypeFamily,
  getBookTypeImageGuidance,
  getBookTypeOutlineGuidance,
};
