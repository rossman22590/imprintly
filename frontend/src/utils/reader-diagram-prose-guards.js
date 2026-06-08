export function isBlockquoteLine(line = "") {
  return /^\s{0,3}>\s?/.test(String(line || ""));
}

export function stripBlockquoteMarker(line = "") {
  return String(line || "").replace(/^\s{0,3}>\s?/, "").trim();
}

export function isMarkdownEmphasisOnlyLine(line = "") {
  const trimmed = stripBlockquoteMarker(line).trim();

  return (
    /^\*\*[^*\n]+\*\*$/.test(trimmed) || /^__[^_\n]+__$/.test(trimmed)
  );
}

export function isRecipeOrMeasurementLine(line = "") {
  const trimmed = stripBlockquoteMarker(line).replace(/\*\*/g, "").trim();

  if (!trimmed) return false;

  return (
    /^\d+\s+(?:cup|cups|teaspoon|teaspoons|tablespoon|tablespoons|drop|drops|ounce|ounces|oz|lb|lbs|gram|grams|g|ml|l|pinch|dash|clove|cloves|slice|slices)\b/i.test(
      trimmed
    ) ||
    /\b\d+\s+(?:cup|cups|teaspoon|teaspoons|tablespoon|tablespoons|drop|drops)\b/i.test(
      trimmed
    )
  );
}

export function isProseCalloutBlock(lines = []) {
  const normalized = lines.map(stripBlockquoteMarker).filter(Boolean);

  if (!normalized.length) return false;

  const recipeLikeCount = normalized.filter(isRecipeOrMeasurementLine).length;
  const emphasisTitles = normalized.filter(isMarkdownEmphasisOnlyLine).length;

  return recipeLikeCount >= 2 || (emphasisTitles > 0 && recipeLikeCount >= 1);
}
