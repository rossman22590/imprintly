const BOOK_BIBLE_FIELDS = [
  "source",
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
  source: "Source",
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

function stringifyBibleValue(value = "") {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = stringifyBibleValue(item).trim();

        if (!text) return "";
        return /^\s*[-*]\s+/.test(text) ? text : `- ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, itemValue]) => {
        const text = stringifyBibleValue(itemValue).trim();

        return text ? `- **${key}**: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(value || "");
}

function sanitizeBibleText(value = "") {
  return stringifyBibleValue(value)
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

function parseBookBibleJsonContent(content = "") {
  const raw = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const trimmed =
    firstBrace >= 0 && lastBrace > firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : raw;

  try {
    return normalizeBookBiblePayload(JSON.parse(trimmed));
  } catch {
    return normalizeBookBiblePayload({ notes: trimmed });
  }
}

module.exports = {
  BOOK_BIBLE_FIELDS,
  BOOK_BIBLE_FIELD_LIMIT,
  BOOK_BIBLE_LABELS,
  normalizeBookBiblePayload,
  parseBookBibleJsonContent,
  stringifyBibleValue,
  serializeBookBible,
};
