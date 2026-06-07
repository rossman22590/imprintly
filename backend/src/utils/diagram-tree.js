const diagramCharacterReplacements = new Map([
  ["\u2500", "-"],
  ["\u2501", "-"],
  ["\u2502", "|"],
  ["\u2503", "|"],
  ["\u250C", "+"],
  ["\u2510", "+"],
  ["\u2514", "+"],
  ["\u2518", "+"],
  ["\u251C", "+"],
  ["\u2524", "+"],
  ["\u252C", "+"],
  ["\u2534", "+"],
  ["\u253C", "+"],
  ["\u2550", "="],
  ["\u2551", "|"],
  ["\u2554", "+"],
  ["\u2557", "+"],
  ["\u255A", "+"],
  ["\u255D", "+"],
  ["\u2560", "+"],
  ["\u2563", "+"],
  ["\u2566", "+"],
  ["\u2569", "+"],
  ["\u256C", "+"],
  ["\u25BC", "v"],
  ["\u25BE", "v"],
  ["\u25B2", "^"],
  ["\u25B4", "^"],
  ["\u25B6", ">"],
  ["\u25BA", ">"],
  ["\u25C0", "<"],
  ["\u25C4", "<"],
  ["\u2190", "<-"],
  ["\u2191", "^"],
  ["\u2192", "->"],
  ["\u2193", "v"],
  ["\u2194", "<->"],
  ["\u21D0", "<="],
  ["\u21D2", "=>"],
  ["\u21D4", "<=>"],
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201C", "\""],
  ["\u201D", "\""],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2026", "..."],
  ["\u2022", "-"],
  ["\u2023", "-"],
  ["\u2043", "-"],
  ["\u25E6", "-"],
  ["\u00B0", " deg "],
  ["\u2248", "~"],
  ["\u2264", "<="],
  ["\u2265", ">="],
]);

function normalizeDiagramText(text = "") {
  return String(text || "")
    .replace(/\t/g, "  ")
    .replace(/\u00A0/g, " ")
    .replace(
      /[\u00B0\u2022\u2023\u2043\u2248\u2264\u2265\u2500-\u257F\u25B2-\u25C4\u25E6\u2190-\u21FF\u2018-\u2026]/g,
      (char) => diagramCharacterReplacements.get(char) || "?"
    );
}

function getNormalizedDiagramLines(lines = []) {
  const output = [];

  lines
    .map((line) => normalizeDiagramText(line).replace(/\s+$/g, ""))
    .filter((line) => line.trim())
    .forEach((line) => {
      const current = line.trim();
      const previous = output[output.length - 1]?.trim();

      if (current && current === previous) return;
      output.push(line);
    });

  return output;
}

function parseTreeHubDiagram(lines = []) {
  const normalized = getNormalizedDiagramLines(lines);

  const hasTreeShape =
    normalized.some((line) => /^\s*\+[-=]{2,}\s+[A-Za-z]/.test(line)) ||
    normalized.some((line) =>
      /[A-Za-z]{3,}[\s\S]*[-+=|]{3,}[\s\S]*[A-Za-z]{3,}/.test(line)
    );

  if (!hasTreeShape) return null;

  const hubLine =
    normalized.find(
      (line) =>
        !/^\s*\+[-=]{2,}\s+[A-Za-z]/.test(line) &&
        /[-+=]{3,}/.test(line) &&
        /[A-Za-z]{4,}/.test(line) &&
        (line.includes("|") || /\+[-=]+/.test(line))
    ) || "";
  const branchLines = normalized.filter((line) =>
    /^\s*\+[-=]{2,}\s+[A-Za-z]/.test(line)
  );

  if (!hubLine && branchLines.length < 1) return null;

  const nodes = [];
  const seen = new Set();
  const addNode = (label, detail = "") => {
    const cleanLabel = String(label || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanLabel || seen.has(cleanLabel)) return;

    seen.add(cleanLabel);
    nodes.push({ label: cleanLabel, detail: String(detail || "").trim() });
  };

  if (hubLine) {
    hubLine
      .split(/[-+=|]+/)
      .map((part) => part.trim())
      .filter((part) => /[A-Za-z]{3,}/.test(part))
      .forEach((part) => {
        const label = part.replace(/\s*\([^)]*\)\s*/g, " ").trim();
        const detailMatch = part.match(/\(([^)]+)\)/);
        addNode(label, detailMatch?.[1] || "");
      });
  }

  branchLines.forEach((line) => {
    const branchMatch = line.match(/^\s*\+[-=]+\s+(.+)$/);
    const part = branchMatch?.[1]?.trim() || "";

    if (!part) return;

    const label = part.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    const detailMatch = part.match(/\(([^)]+)\)/);
    addNode(label, detailMatch?.[1] || "");
  });

  if (nodes.length < 2) return null;

  return {
    title: "",
    nodes,
    connectors: [],
  };
}

function extractDiagramLabelDirective(lines = []) {
  if (!lines.length) return { label: "", lines };

  const match = String(lines[0] || "")
    .trim()
    .match(/^@label\s+(.+)$/i);

  if (!match) return { label: "", lines };

  return {
    label: match[1].trim(),
    lines: lines.slice(1),
  };
}

module.exports = {
  extractDiagramLabelDirective,
  parseTreeHubDiagram,
};
