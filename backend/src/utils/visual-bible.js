const crypto = require("crypto");
const { normalizeTrustedImageUrl } = require("./image-storage");

const MAX_REFERENCES = {
  characters: 8,
  styleReferences: 4,
  worldReferences: 6,
};

function sanitizeText(value = "", limit = 1000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function makeReferenceId(value = "") {
  const source = sanitizeText(value, 200) || crypto.randomUUID();

  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || crypto.randomUUID();
}

function normalizeReference(reference = {}, kind = "reference") {
  const name = sanitizeText(reference.name || reference.label, 120);
  const label = sanitizeText(reference.label || reference.name, 120);
  const description = sanitizeText(reference.description, 1200);
  const imageUrl = normalizeTrustedImageUrl(reference.imageUrl || reference.url || "");

  if (!name && !label && !description && !imageUrl) return null;

  return {
    id: sanitizeText(reference.id, 100) || makeReferenceId(name || label || description),
    name,
    label,
    description,
    imageUrl,
    kind,
  };
}

function normalizeReferenceList(values = [], key = "references", kind = "reference") {
  if (!Array.isArray(values)) return [];

  const seen = new Set();

  return values
    .slice(0, MAX_REFERENCES[key] || 6)
    .map((value) => normalizeReference(value, kind))
    .filter(Boolean)
    .filter((reference) => {
      const dedupeKey = `${reference.id}|${reference.imageUrl}`;

      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);

      return true;
    });
}

function normalizeVisualBiblePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};

  return {
    enabled: source.enabled !== false,
    matchBookStyle: source.matchBookStyle !== false,
    characters: normalizeReferenceList(source.characters, "characters", "character"),
    styleReferences: normalizeReferenceList(
      source.styleReferences,
      "styleReferences",
      "style"
    ),
    worldReferences: normalizeReferenceList(
      source.worldReferences,
      "worldReferences",
      "world"
    ),
    notes: sanitizeText(source.notes, 2000),
    updatedAt: source.updatedAt || null,
  };
}

function getChapterSearchText(chapter = {}) {
  return [
    chapter.title,
    chapter.description,
    String(chapter.content || "").replace(/!\[[^\]]*\]\([^)]+\)/g, " "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function referenceMatchesChapter(reference = {}, chapterText = "") {
  const name = sanitizeText(reference.name || reference.label, 120).toLowerCase();

  if (!name) return false;

  return chapterText.includes(name);
}

function pickVisualReferencesForChapter(
  visualBible = {},
  chapter = {},
  { selectedReferenceIds = null } = {}
) {
  const bible = normalizeVisualBiblePayload(visualBible);

  if (!bible.enabled) return [];

  const selectedIds = Array.isArray(selectedReferenceIds)
    ? new Set(selectedReferenceIds.map((id) => String(id)))
    : null;
  const chapterText = getChapterSearchText(chapter);
  const characters = selectedIds
    ? bible.characters.filter((reference) => selectedIds.has(reference.id))
    : bible.characters;
  const worldReferences = bible.worldReferences.filter((reference) =>
    selectedIds ? selectedIds.has(reference.id) : referenceMatchesChapter(reference, chapterText)
  );
  const matchingWorldReferences = worldReferences.length
    ? worldReferences
    : bible.worldReferences.slice(0, 1);

  return [
    ...characters.slice(0, 8),
    ...bible.styleReferences.slice(0, 2),
    ...matchingWorldReferences.slice(0, 2),
  ].filter((reference) => reference.imageUrl);
}

function buildVisualReferencePromptContext(
  visualBible = {},
  chapter = {},
  options = {}
) {
  const references = pickVisualReferencesForChapter(visualBible, chapter, options);

  if (!references.length) return "";

  const lines = references.map((reference, index) => {
    const title =
      reference.name || reference.label || `${reference.kind} reference ${index + 1}`;
    const description = reference.description
      ? `: ${reference.description}`
      : "";

    return `- ${reference.kind}: ${title}${description}`;
  });

  return [
    "Visual Bible references provided:",
    ...lines,
    "These references are mandatory visual canon for matching characters, recurring objects, settings, and style. The reference images are identity/style inputs, not a requirement to place every referenced person in the scene. Only include characters or places that belong in this chapter scene.",
  ].join("\n");
}

function serializeVisualReference(reference = {}, fallbackName = "Reference") {
  const name = sanitizeText(reference.name || reference.label, 120) || fallbackName;
  const description = sanitizeText(reference.description, 1200);
  const imageNote = reference.imageUrl ? " [reference image supplied]" : "";
  const detail = description ? ` - ${description}` : "";

  return `- ${name}${detail}${imageNote}`;
}

function serializeVisualBible(visualBible = {}) {
  const bible = normalizeVisualBiblePayload(visualBible);

  if (!bible.enabled) return "";

  const sections = [];

  if (bible.characters.length) {
    sections.push(
      [
        "## Visual Characters",
        ...bible.characters.map((reference, index) =>
          serializeVisualReference(reference, `Character ${index + 1}`)
        ),
      ].join("\n")
    );
  }

  if (bible.styleReferences.length) {
    sections.push(
      [
        "## Visual Style",
        ...bible.styleReferences.map((reference, index) =>
          serializeVisualReference(reference, `Style reference ${index + 1}`)
        ),
      ].join("\n")
    );
  }

  if (bible.worldReferences.length) {
    sections.push(
      [
        "## Visual Worlds And Locations",
        ...bible.worldReferences.map((reference, index) =>
          serializeVisualReference(reference, `World reference ${index + 1}`)
        ),
      ].join("\n")
    );
  }

  if (bible.notes) {
    sections.push(`## Visual Notes\n${bible.notes}`);
  }

  return sections.join("\n\n").slice(0, 8000);
}

function getVisualReferenceUrlsForChapter(visualBible = {}, chapter = {}, options = {}) {
  return pickVisualReferencesForChapter(visualBible, chapter, options).map(
    (reference) => reference.imageUrl
  );
}

module.exports = {
  buildVisualReferencePromptContext,
  getVisualReferenceUrlsForChapter,
  normalizeVisualBiblePayload,
  pickVisualReferencesForChapter,
  serializeVisualBible,
};
