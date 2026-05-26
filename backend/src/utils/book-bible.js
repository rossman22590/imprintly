const BOOK_BIBLE_FIELDS = [
  "characters",
  "locations",
  "worldRules",
  "timeline",
  "styleGuide",
  "canonFacts",
  "unresolvedThreads",
  "notes",
];

const BOOK_BIBLE_LABELS = {
  characters: "Characters",
  locations: "Locations",
  worldRules: "World Rules",
  timeline: "Timeline",
  styleGuide: "Style Guide",
  canonFacts: "Canon Facts",
  unresolvedThreads: "Unresolved Threads",
  notes: "Notes",
};

const BOOK_BIBLE_FIELD_LIMIT = 12000;
const BOOK_BIBLE_PROMPT_LIMIT = 18000;

function sanitizeBibleText(value = "") {
  return String(value || "")
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .slice(0, BOOK_BIBLE_FIELD_LIMIT);
}

function normalizeBookBiblePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};

  return BOOK_BIBLE_FIELDS.reduce((bible, field) => {
    bible[field] = sanitizeBibleText(source[field]);
    return bible;
  }, {});
}

function serializeBookBible(bible = {}) {
  if (!bible) return "";

  if (typeof bible === "string") {
    return sanitizeBibleText(bible).slice(0, BOOK_BIBLE_PROMPT_LIMIT);
  }

  const normalized = normalizeBookBiblePayload(bible);
  const sections = BOOK_BIBLE_FIELDS.map((field) => {
    const value = normalized[field].trim();

    return value ? `## ${BOOK_BIBLE_LABELS[field]}\n${value}` : "";
  }).filter(Boolean);

  return sections.join("\n\n").slice(0, BOOK_BIBLE_PROMPT_LIMIT);
}

module.exports = {
  BOOK_BIBLE_FIELDS,
  BOOK_BIBLE_FIELD_LIMIT,
  BOOK_BIBLE_LABELS,
  normalizeBookBiblePayload,
  serializeBookBible,
};
