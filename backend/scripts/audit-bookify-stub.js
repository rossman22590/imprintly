export function toBookifyDiagram() {
  return null;
}

export function toBookifyPreDiagram(lines = [], label = "") {
  return {
    type: "pre",
    title: String(label || "").trim() || "Diagram",
    lines: lines.map((line) => String(line || "")),
  };
}
