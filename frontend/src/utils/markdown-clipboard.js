function decodeHtmlEntities(value = "") {
  if (typeof document === "undefined") return value;

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;

  return textarea.value;
}

function convertMarkdownTable(lines, startIndex) {
  const output = [];
  let index = startIndex;

  while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
    const line = lines[index];
    const isSeparator = /^\s*\|?[\s:|.-]+\|?\s*$/.test(line);

    if (!isSeparator) {
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cleanInlineMarkdown(cell.trim()));

      output.push(cells.join("\t"));
    }

    index += 1;
  }

  return { lines: output, nextIndex: index };
}

function cleanInlineMarkdown(value = "") {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

export function markdownToPlainText(markdown = "") {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence && /^\s*\|.*\|\s*$/.test(line)) {
      const table = convertMarkdownTable(lines, index);
      output.push(...table.lines);
      index = table.nextIndex - 1;
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    let cleanLine = line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s{0,3}>\s?/, "")
      .replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/, "")
      .replace(/^(\s*)[-*+]\s+/, "$1- ")
      .replace(/^(\s*)\d+[.)]\s+/, (match, indent) => `${indent}${match.trim()} `)
      .trimEnd();

    output.push(cleanInlineMarkdown(cleanLine));
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
