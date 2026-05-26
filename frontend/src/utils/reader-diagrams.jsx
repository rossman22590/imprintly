import React from "react";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import { resolveImageUrl } from "./api-endpoints";

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
]);

function normalizeDiagramText(text = "") {
  return String(text || "")
    .replace(/\t/g, "  ")
    .replace(/\u00A0/g, " ")
    .replace(
      /[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF\u2018-\u2026]/g,
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

function isFenceLine(line = "") {
  return /^\s*(```|~~~)/.test(line);
}

function isAsciiDiagramLine(line = "") {
  const trimmed = line.trim();

  if (!trimmed) return false;
  if (/[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(trimmed)) return true;
  if (/^\[[^\]]{2,}\]/.test(trimmed)) return true;
  if (!/^[+|<>^v/\\-]/.test(trimmed)) return false;

  const diagramChars = (trimmed.match(/[+\-|]/g) || []).length;

  return diagramChars >= 2 || /^[<>^v/\\|\-+\s]+$/.test(trimmed);
}

function isAsciiDiagramBlock(lines = []) {
  if (lines.length < 3) return false;

  if (lines.some((line) => /[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(line))) {
    return true;
  }

  const bracketRows = lines.filter((line) =>
    (line.match(/\[[^\]]{2,}\]/g) || []).length > 0
  ).length;
  const connectorRows = lines.filter((line) => {
    const trimmed = line.trim();

    return /^[<>^v/\\|\-+\s]+$/.test(trimmed) && /[<>^v/\\|\-+]/.test(trimmed);
  }).length;

  if (bracketRows >= 1 && connectorRows >= 1) return true;

  const separatorCount = lines.filter((line) => /^\s*\+[-+]+\+?\s*$/.test(line))
    .length;
  const contentCount = lines.filter((line) => /^\s*\|/.test(line)).length;

  return separatorCount >= 2 && contentCount >= 1;
}

function normalizeReaderMarkdown(markdown = "") {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let block = [];
  let inFence = false;

  const flushBlock = () => {
    if (block.length === 0) return;

    if (isAsciiDiagramBlock(block)) {
      if (output.length > 0 && output[output.length - 1] !== "") {
        output.push("");
      }

      output.push("```reader-diagram", ...block, "```");
    } else {
      output.push(...block);
    }

    block = [];
  };

  lines.forEach((line) => {
    if (isFenceLine(line)) {
      flushBlock();
      output.push(line);
      inFence = !inFence;
      return;
    }

    if (!inFence && isAsciiDiagramLine(line)) {
      block.push(line);
      return;
    }

    flushBlock();
    output.push(line);
  });

  flushBlock();

  return output.join("\n");
}

function getBracketNodes(line = "") {
  return Array.from(String(line || "").matchAll(/\[([^\]]{2,})\]/g)).map(
    (match) => ({
      label: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
      center: match.index + match[0].length / 2,
    })
  );
}

function cleanSegmentLine(line = "") {
  return String(line || "")
    .replace(/^\s*[|+]\s?/, "")
    .replace(/\s?[|+]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isBoxBorderLine(line = "") {
  const trimmed = String(line || "").trim();
  const horizontalCount = (trimmed.match(/[-=]/g) || []).length;

  return trimmed.startsWith("+") && trimmed.endsWith("+") && horizontalCount >= 8;
}

function hasConnectorLine(lines = []) {
  return lines.some((line) => {
    const trimmed = String(line || "").trim();

    return /^[|v^<>+\-/\\\s]+$/.test(trimmed) && /[|v^<>+\-/\\]/.test(trimmed);
  });
}

function parseFlowDiagram(lines = []) {
  const normalizedLines = getNormalizedDiagramLines(lines);
  const nodeRows = normalizedLines
    .map((line, index) => ({
      index,
      line,
      nodes: getBracketNodes(line),
    }))
    .filter((row) => row.nodes.length > 0);

  if (nodeRows.length < 2) return null;

  const titleRow =
    nodeRows[0].nodes.length === 1 && nodeRows.length > 1 ? nodeRows[0] : null;
  const childRows = titleRow ? nodeRows.slice(1) : nodeRows;
  const childRow = childRows.reduce(
    (best, row) => (row.nodes.length > best.nodes.length ? row : best),
    childRows[0]
  );

  if (!childRow || childRow.nodes.length < 2 || childRow.nodes.length > 4) {
    return null;
  }

  const details = childRow.nodes.map(() => []);
  const boundaries = childRow.nodes.map((node, index) => {
    const previousCenter = childRow.nodes[index - 1]?.center ?? 0;
    const nextCenter = childRow.nodes[index + 1]?.center ?? Number.POSITIVE_INFINITY;

    return {
      start: index === 0 ? 0 : Math.floor((previousCenter + node.center) / 2),
      end:
        index === childRow.nodes.length - 1
          ? Number.POSITIVE_INFINITY
          : Math.ceil((node.center + nextCenter) / 2),
    };
  });

  normalizedLines
    .slice(childRow.index + 1)
    .filter((line) => line.trim())
    .forEach((line) => {
      let assigned = false;

      boundaries.forEach((boundary, index) => {
        const segment = line
          .slice(boundary.start, boundary.end === Infinity ? undefined : boundary.end)
          .trim();

        if (segment) {
          details[index].push(segment);
          assigned = true;
        }
      });

      if (!assigned && line.trim()) {
        details[details.length - 1].push(line.trim());
      }
    });

  return {
    type: "flow",
    title: titleRow?.nodes[0]?.label || "",
    nodes: childRow.nodes.map((node, index) => ({
      label: node.label,
      detail: details[index].join("\n"),
    })),
  };
}

function parseStackDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);
  const borderCount = nonEmptyLines.filter(isBoxBorderLine).length;

  if (borderCount < 2) return null;

  const titleNode = getBracketNodes(nonEmptyLines[0])[0];
  const title = titleNode?.label || "";
  const bodyLines = titleNode ? nonEmptyLines.slice(1) : nonEmptyLines;
  const segments = [];
  let current = [];
  let hasSeenBorder = false;

  bodyLines.forEach((line) => {
    if (isBoxBorderLine(line)) {
      if (hasSeenBorder && current.length > 0) {
        segments.push(current);
      }

      current = [];
      hasSeenBorder = true;
      return;
    }

    if (hasSeenBorder) current.push(line);
  });

  if (current.length > 0) segments.push(current);

  const layers = [];
  const connectors = [];

  segments.forEach((segment) => {
    const cleanedLines = segment.map(cleanSegmentLine).filter(Boolean);

    if (cleanedLines.length === 0) return;

    const connectorOnly = cleanedLines.every((line) =>
      /^([|v^<>]+|\(?[A-Za-z][A-Za-z\s-]*Request\)?|[-=]+|[|v^<>\s-]+)$/.test(
        line
      )
    );

    if (connectorOnly) {
      const label =
        cleanedLines.find((line) => /[A-Za-z]/.test(line))?.replace(/^\((.*)\)$/, "$1") ||
        "";
      if (label) connectors.push(label);
      return;
    }

    layers.push({
      label: cleanedLines[0],
      detail: cleanedLines.slice(1).join("\n"),
    });
  });

  if (layers.length < 2) return null;

  return {
    type: "stack",
    title,
    layers,
    connectors,
  };
}

function splitTableLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseTableDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);
  const borderLines = nonEmptyLines.filter(isBoxBorderLine);

  if (borderLines.length < 2) return null;

  const maxColumns = Math.max(
    ...borderLines.map((line) => Math.max(0, line.trim().split("+").length - 2)),
    0
  );

  if (maxColumns < 2) return null;

  const rows = [];
  let currentGroup = [];
  let hasSeenBorder = false;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    const parsedLines = currentGroup.map(splitTableLine).filter(Boolean);
    const columnCount = Math.max(...parsedLines.map((cells) => cells.length), 0);

    if (columnCount >= 2) {
      const cells = Array.from({ length: columnCount }, (_, columnIndex) =>
        parsedLines
          .map((lineCells) => lineCells[columnIndex] || "")
          .filter(Boolean)
          .join("\n")
          .trim()
      );

      if (cells.some(Boolean)) rows.push(cells);
    }

    currentGroup = [];
  };

  nonEmptyLines.forEach((line) => {
    if (isBoxBorderLine(line)) {
      if (hasSeenBorder) flushGroup();
      hasSeenBorder = true;
      return;
    }

    if (hasSeenBorder && splitTableLine(line)) {
      currentGroup.push(line);
    }
  });

  flushGroup();

  if (rows.length < 2) return null;

  const columnCount = Math.max(...rows.map((row) => row.length), 0);

  if (columnCount < 2 || columnCount > 5) return null;

  const paddedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] || "")
  );

  return {
    type: "table",
    header: paddedRows[0],
    rows: paddedRows.slice(1),
  };
}

function parseLinearFlowDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);
  const arrowPattern = /(-->|<-->|<--|->|<-|=>|<==>|<==|==>|===|<=>)/;
  const hasArrow = nonEmptyLines.some((line) => arrowPattern.test(line));

  if (hasArrow && nonEmptyLines.length === 1) {
    const parts = nonEmptyLines[0]
      .split(arrowPattern)
      .filter((part) => part && !arrowPattern.test(part))
      .map((part) =>
        part
          .replace(/^\s*\[|\]\s*$/g, "")
          .replace(/^\s*\(|\)\s*$/g, "")
          .trim()
      )
      .filter(Boolean);

    if (parts.length >= 2 && parts.length <= 5) {
      return {
        type: "linear",
        nodes: parts.map((part) => ({ label: part, detail: "" })),
      };
    }
  }

  const nodeRows = nonEmptyLines
    .map((line) => ({
      line,
      nodes: getBracketNodes(line),
    }))
    .filter((row) => row.nodes.length > 0);

  if (nodeRows.length < 2 || nodeRows.length > 8 || !hasConnectorLine(nonEmptyLines)) {
    return null;
  }

  return {
    type: "linear",
    nodes: nodeRows.map((row) => ({
      label: row.nodes[0].label,
      detail: cleanSegmentLine(row.line.slice(row.nodes[0].end)),
    })),
  };
}

function isConnectorOnlyLine(line = "") {
  const trimmed = String(line || "").trim();

  return /^[|v^<>+\-/\\\s]+$/.test(trimmed) && /[|v^<>+\-/\\]/.test(trimmed);
}

function cleanConnectorLabel(value = "") {
  return String(value || "")
    .replace(/^\|?\s*/, "")
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProcessBoxLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed.startsWith("|")) return null;

  const content = trimmed.replace(/^\|\s*/, "").replace(/\s*\|$/, "").trim();

  if (!content || isConnectorOnlyLine(content)) return null;
  if (/^\(.*/.test(content)) {
    return {
      connector: cleanConnectorLabel(content),
    };
  }

  const [labelPart, ...rest] = content.split("|");
  const label = labelPart.trim();
  const detail = rest
    .join("|")
    .replace(/^\s*[-=]*>\s*/, "")
    .trim();

  if (!label) return null;

  return {
    label,
    detail,
  };
}

function parseProcessDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);

  if (nonEmptyLines.length < 5) return null;

  const hasVerticalConnectors = nonEmptyLines.filter(isConnectorOnlyLine).length >= 2;
  const hasBoxLines = nonEmptyLines.some((line) => line.trim().startsWith("|"));

  if (!hasVerticalConnectors || !hasBoxLines) return null;

  const nodes = [];
  const connectors = [];
  let pendingConnector = "";

  const addNode = (label, detail = "") => {
    const cleanLabel = String(label || "")
      .replace(/^\[|\]$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const cleanDetail = String(detail || "").replace(/\s+/g, " ").trim();

    if (!cleanLabel || /^[-+=]+$/.test(cleanLabel)) return;

    if (nodes.length > 0 && pendingConnector) {
      connectors[nodes.length - 1] = pendingConnector;
      pendingConnector = "";
    }

    nodes.push({
      label: cleanLabel,
      detail: cleanDetail,
    });
  };

  nonEmptyLines.forEach((line) => {
    const trimmed = line.trim();

    if (isBoxBorderLine(trimmed) || isConnectorOnlyLine(trimmed)) return;

    const boxed = parseProcessBoxLine(trimmed);

    if (boxed?.connector) {
      pendingConnector = [pendingConnector, boxed.connector].filter(Boolean).join(" ");
      return;
    }

    if (boxed?.label) {
      addNode(boxed.label, boxed.detail);
      return;
    }

    const bracketNode = trimmed.match(/^\[([^\]]{2,})\]$/);

    if (bracketNode) {
      addNode(bracketNode[1]);
      return;
    }

    if (/^\(.*/.test(trimmed) || pendingConnector) {
      pendingConnector = [pendingConnector, cleanConnectorLabel(trimmed)]
        .filter(Boolean)
        .join(" ");
      return;
    }

    if (nodes.length === 0 || /:/.test(trimmed)) {
      addNode(trimmed);
      return;
    }

    nodes[nodes.length - 1].detail = [nodes[nodes.length - 1].detail, trimmed]
      .filter(Boolean)
      .join(" ");
  });

  if (nodes.length < 3) return null;

  return {
    type: "process",
    nodes,
    connectors,
  };
}

function parseReaderDiagram(lines = []) {
  return (
    parseTableDiagram(lines) ||
    parseStackDiagram(lines) ||
    parseProcessDiagram(lines) ||
    parseFlowDiagram(lines) ||
    parseLinearFlowDiagram(lines) ||
    parseBadgeBlock(lines)
  );
}

function parseBadgeBlock(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);
  const title = nonEmptyLines[0]?.trim().match(/^\[([^\]]{8,})\]$/)?.[1] || "";

  if (!title || nonEmptyLines.length < 2) return null;
  if (!/(verified|clearance|certificate|badge|compliance|safety|id)/i.test(title)) {
    return null;
  }

  const items = nonEmptyLines
    .slice(1)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter((line) => /^[^:]{2,60}:\s+/.test(line))
    .map((line) => {
      const [label, ...valueParts] = line.split(":");

      return {
        label: label?.trim() || "Detail",
        value: valueParts.join(":").trim() || line,
      };
    });

  if (items.length < 2 || items.length < nonEmptyLines.length - 2) return null;

  return {
    type: "badge",
    title,
    items,
  };
}

function DiagramShell({ title, children }) {
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white shadow-sm">
      {title ? (
        <figcaption className="border-b border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold tracking-wide text-slate-800">
          {title}
        </figcaption>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  );
}

function NodeCard({ node }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-sm font-bold leading-snug text-slate-950">{node.label}</p>
      {node.detail ? (
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
          {node.detail}
        </p>
      ) : null}
    </div>
  );
}

function FlowDiagram({ diagram }) {
  return (
    <DiagramShell title={diagram.title || "Flow"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {diagram.nodes.map((node, index) => (
          <React.Fragment key={`${node.label}-${index}`}>
            <div className="flex-1">
              <NodeCard node={node} />
            </div>
            {index < diagram.nodes.length - 1 ? (
              <div className="flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-violet-400 lg:px-1">
                <span className="lg:hidden">v</span>
                <span className="hidden lg:inline">-&gt;</span>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </DiagramShell>
  );
}

function StackDiagram({ diagram }) {
  return (
    <DiagramShell title={diagram.title || "Architecture"}>
      <div className="mx-auto max-w-2xl space-y-3">
        {diagram.layers.map((layer, index) => (
          <React.Fragment key={`${layer.label}-${index}`}>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
              <p className="text-sm font-bold text-slate-950">{layer.label}</p>
              {layer.detail ? (
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                  {layer.detail}
                </p>
              ) : null}
            </div>
            {index < diagram.layers.length - 1 ? (
              <div className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-500">
                <span className="h-5 w-px bg-violet-300" />
                {diagram.connectors[index] ? <span>{diagram.connectors[index]}</span> : null}
                <span className="text-base leading-none">v</span>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </DiagramShell>
  );
}

function TableDiagram({ diagram }) {
  return (
    <DiagramShell title="Structured Table">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              {diagram.header.map((cell, index) => (
                <th key={`${cell}-${index}`} className="px-4 py-3 text-left font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diagram.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="border-t border-slate-200 px-4 py-3 align-top text-slate-700"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DiagramShell>
  );
}

function LinearDiagram({ diagram }) {
  return (
    <DiagramShell title="Process Flow">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {diagram.nodes.map((node, index) => (
          <React.Fragment key={`${node.label}-${index}`}>
            <div className="flex-1">
              <NodeCard node={node} />
            </div>
            {index < diagram.nodes.length - 1 ? (
              <div className="flex items-center justify-center text-xs font-bold text-violet-400 md:px-1">
                <span className="md:hidden">v</span>
                <span className="hidden md:inline">-&gt;</span>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </DiagramShell>
  );
}

function ProcessDiagram({ diagram }) {
  return (
    <DiagramShell title="Process Flow">
      <div className="mx-auto max-w-2xl space-y-3">
        {diagram.nodes.map((node, index) => (
          <React.Fragment key={`${node.label}-${index}`}>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-sm font-bold leading-snug text-slate-950">
                {node.label}
              </p>
              {node.detail ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {node.detail}
                </p>
              ) : null}
            </div>
            {index < diagram.nodes.length - 1 ? (
              <div className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500">
                <span className="h-5 w-px bg-violet-300" />
                {diagram.connectors[index] ? (
                  <span className="max-w-sm rounded-full bg-violet-50 px-3 py-1 text-center text-violet-700">
                    {diagram.connectors[index]}
                  </span>
                ) : null}
                <span className="text-base leading-none">v</span>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </DiagramShell>
  );
}

function BadgeBlock({ diagram }) {
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm">
      <figcaption className="border-b border-emerald-200 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
        {diagram.title}
      </figcaption>
      <dl className="grid gap-3 p-4 sm:p-5">
        {diagram.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-xl border border-emerald-100 bg-white px-4 py-3"
          >
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-800">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

function getTextFromChildren(children) {
  if (children === null || children === undefined) return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (React.isValidElement(children)) {
    return getTextFromChildren(children.props.children);
  }

  return "";
}

function getCodeClassName(children) {
  if (Array.isArray(children)) {
    return children.map(getCodeClassName).find(Boolean) || "";
  }
  if (React.isValidElement(children)) {
    return children.props.className || getCodeClassName(children.props.children);
  }

  return "";
}

export function ReaderCodeBlock({ children, className = "", inline = false }) {
  const code = String(children || "").replace(/\n$/, "");
  const language = className.match(/language-(\S+)/)?.[1] || "";
  const lines = code.split("\n");
  const shouldTryDiagram =
    language === "reader-diagram" ||
    ["text", "txt", "plain", "diagram", "flow", ""].includes(language);
  const diagram = shouldTryDiagram ? parseReaderDiagram(lines) : null;

  if (inline) {
    return (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-rose-700">
        {children}
      </code>
    );
  }

  if (diagram?.type === "table") return <TableDiagram diagram={diagram} />;
  if (diagram?.type === "stack") return <StackDiagram diagram={diagram} />;
  if (diagram?.type === "process") return <ProcessDiagram diagram={diagram} />;
  if (diagram?.type === "flow") return <FlowDiagram diagram={diagram} />;
  if (diagram?.type === "linear") return <LinearDiagram diagram={diagram} />;
  if (diagram?.type === "badge") return <BadgeBlock diagram={diagram} />;

  return (
    <div className="not-prose my-7 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <span className="block whitespace-pre font-mono text-[0.82em] leading-relaxed text-slate-800">
        {code}
      </span>
    </div>
  );
}

const readerMarkdownComponents = {
  a({ href = "", children }) {
    const isExternal = /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  img({ src = "", alt = "" }) {
    return (
      <img
        src={resolveImageUrl(src)}
        alt={alt}
        loading="lazy"
        className="mx-auto my-8 max-h-[560px] rounded-2xl border border-slate-200 object-contain shadow-sm"
      />
    );
  },
  pre({ children }) {
    return (
      <ReaderCodeBlock className={getCodeClassName(children)}>
        {getTextFromChildren(children)}
      </ReaderCodeBlock>
    );
  },
  code({ inline, className = "", children }) {
    const code = getTextFromChildren(children);

    if (inline || (!className && !code.includes("\n"))) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-rose-700">
          {children}
        </code>
      );
    }

    return <code className={className}>{children}</code>;
  },
};

export function ReaderMarkdownContent({ source = "", fontSize = 18 }) {
  return (
    <MDEditor.Markdown
      source={normalizeReaderMarkdown(source)}
      rehypePlugins={[[rehypeSanitize]]}
      components={readerMarkdownComponents}
      wrapperElement={{ "data-color-mode": "light" }}
      style={{
        backgroundColor: "transparent",
        color: "inherit",
        fontFamily: "Charter, Georgia, 'Times New Roman', serif",
        fontSize,
        lineHeight: 1.7,
      }}
      className="reading-content"
    />
  );
}
