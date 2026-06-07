const { isDedicatedDiagramFence } = require("./kdp-markdown-blocks");
const {
  extractDiagramLabelDirective,
  parseTreeHubDiagram,
} = require("./diagram-tree");
const { __private: diagramTools } = require("./pdf.generator");

function parseExportDiagram(content = "", language = "") {
  if (!isDedicatedDiagramFence(language, content)) {
    return null;
  }

  const rawLines = String(content || "").replace(/\n$/, "").split("\n");
  const { label, lines } = extractDiagramLabelDirective(rawLines);

  const tree = parseTreeHubDiagram(lines);

  if (tree) {
    return {
      type: "flow",
      title: tree.title || "Diagram",
      nodes: tree.nodes,
      label,
    };
  }

  const table = diagramTools.parseAsciiTableDiagram(lines);

  if (table) {
    return { type: "table", label, ...table };
  }

  const systemComparison = diagramTools.parseSystemComparisonDiagram(lines);

  if (systemComparison) {
    return { type: "flow", label, ...systemComparison };
  }

  const nestedArchitecture = diagramTools.parseNestedArchitectureDiagram(lines);

  if (nestedArchitecture) {
    return {
      type: "flow",
      title: nestedArchitecture.title || "Architecture",
      nodes: nestedArchitecture.layers,
      label,
    };
  }

  const boxedList = diagramTools.parseBoxedListDiagram(lines);

  if (boxedList) {
    return { type: "boxed-list", label, ...boxedList };
  }

  const process = diagramTools.parseProcessDiagram(lines);

  if (process) {
    return { type: "flow", label, ...process };
  }

  const stack = diagramTools.parseStackDiagram(lines);

  if (stack) {
    return {
      type: "flow",
      title: stack.title || "Diagram",
      nodes: stack.layers,
      label,
    };
  }

  const flow =
    diagramTools.parseFlowDiagram(lines) ||
    diagramTools.parseBranchDiagram(lines) ||
    diagramTools.parseComparisonDiagram(lines) ||
    diagramTools.parseLinearFlowDiagram(lines);

  if (flow) {
    return { type: "flow", label, ...flow };
  }

  if (diagramTools.isDiagramCodeBlock(lines)) {
    return {
      type: "pre",
      title: label || "Diagram",
      lines: lines.map(diagramTools.normalizeCodeTextForPdf),
      label,
    };
  }

  const stepNodes = lines
    .map((line) => String(line || "").trim())
    .filter((line) => line && !/^[v^<>|+\-\\/.\s]+$/.test(line));

  if (stepNodes.length >= 2 && stepNodes.length <= 12) {
    return {
      type: "flow",
      title: label || "Diagram",
      nodes: stepNodes.map((step) => ({ label: step, detail: "" })),
      label,
    };
  }

  return null;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderDiagramHtml(diagram) {
  if (!diagram) return "";

  const caption = String(diagram.label || diagram.title || "").trim();
  const defaultCaptions = {
    table: "Structured Table",
    flow: "Diagram",
    "boxed-list": "Key Points",
    pre: "Diagram",
  };
  const figcaption = escapeXml(
    caption || defaultCaptions[diagram.type] || "Diagram"
  );

  if (diagram.type === "table") {
    return `<figure class="bookify-diagram"><figcaption>${figcaption}</figcaption><table class="bookify-table"><thead><tr>${diagram.header
      .map((cell) => `<th>${escapeXml(cell)}</th>`)
      .join("")}</tr></thead><tbody>${diagram.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeXml(cell)}</td>`).join("")}</tr>`
      )
      .join("")}</tbody></table></figure>`;
  }

  if (diagram.type === "flow") {
    return `<figure class="bookify-diagram"><figcaption>${figcaption}</figcaption><div class="bookify-flow">${(diagram.nodes || [])
      .map(
        (node, index) =>
          `<div class="bookify-node"><strong>${escapeXml(
            node.label
          )}</strong>${node.detail ? `<p>${escapeXml(node.detail)}</p>` : ""}</div>${
            index < diagram.nodes.length - 1
              ? '<div class="bookify-arrow">↓</div>'
              : ""
          }`
      )
      .join("")}</div></figure>`;
  }

  if (diagram.type === "boxed-list") {
    return `<figure class="bookify-diagram bookify-callout"><figcaption>${figcaption}</figcaption><ol class="bookify-list">${(diagram.items || [])
      .map((item) => {
        const match = String(item).match(/^\d+[).]\s*(.*)$/);
        return `<li>${escapeXml(match ? match[1] : item)}</li>`;
      })
      .join("")}</ol></figure>`;
  }

  if (diagram.type === "pre") {
    return `<figure class="bookify-diagram"><figcaption>${figcaption}</figcaption><pre>${escapeXml(
      diagram.lines.join("\n")
    )}</pre></figure>`;
  }

  return "";
}

module.exports = {
  extractDiagramLabelDirective,
  parseExportDiagram,
  renderDiagramHtml,
};
