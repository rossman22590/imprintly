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

function isDiagramHeadingLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed) return false;
  if (isAsciiDiagramLine(trimmed)) return false;

  return (
    /^[A-Z0-9][A-Za-z0-9\s/()&.-]{5,}:\s*$/.test(trimmed) ||
    /^(System Diagram|Diagram|Architecture|Process Flow|Flow Diagram)$/i.test(trimmed)
  );
}

function hasNearbyAsciiDiagramLine(lines = [], startIndex = 0) {
  return lines
    .slice(startIndex + 1, startIndex + 4)
    .some((line) => isAsciiDiagramLine(line));
}

function isMarkdownDiagramHeading(line = "") {
  return /^\s{0,3}#{1,6}\s+\S/.test(String(line || ""));
}

function getMarkdownDiagramHeadingLabel(line = "") {
  return String(line || "")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .trim();
}

function isSimpleStepLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed || trimmed.length > 100) return false;
  if (/^(```|~~~)/.test(trimmed)) return false;
  if (/^\s{0,3}#{1,6}\s+/.test(trimmed)) return false;
  if (/^[-*+]\s+/.test(trimmed)) return false;
  if (/^\d+\.\s+/.test(trimmed)) return false;
  if (/^[+\-|<>^v\\/_.\s]+$/.test(trimmed)) return false;
  if (/[.!?]["']?\s*$/.test(trimmed) && !/^Title:/i.test(trimmed)) return false;

  return /[A-Za-z]/.test(trimmed);
}

function isSimpleStepFlowLabel(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed || trimmed.length > 72) return false;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount > 10) return false;
  if (/[.!?]["']?$/.test(trimmed)) return false;
  if (!isSimpleStepLine(trimmed)) return false;
  if (/^Title:/i.test(trimmed)) return false;

  return true;
}

function collectSimpleStepFlowLines(lines = [], startIndex = 0) {
  const collected = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const currentLine = lines[index];

    if (!currentLine.trim()) break;
    if (isFenceLine(currentLine)) break;
    if (isMarkdownDiagramHeading(currentLine)) break;
    if (isAsciiDiagramLine(currentLine)) break;
    if (!isSimpleStepLine(currentLine)) break;

    collected.push(currentLine);
  }

  return collected;
}

function parseSimpleStepFlowDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);

  if (nonEmptyLines.length < 3 || nonEmptyLines.length > 12) return null;
  if (!nonEmptyLines.every(isSimpleStepLine)) return null;

  let title = "";
  let startIndex = 0;
  const titleMatch = nonEmptyLines[0].match(/^Title:\s*(.+)$/i);

  if (titleMatch) {
    title = titleMatch[1].trim();
    startIndex = 1;
  }

  const steps = nonEmptyLines.slice(startIndex);

  if (steps.length < 2) return null;

  return {
    type: "process",
    title,
    nodes: steps.map((label) => ({ label, detail: "" })),
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

function isAsciiDiagramContinuationLine(line = "", block = []) {
  if (block.length === 0) return false;

  const value = String(line || "");
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (!/^\s{2,}\S/.test(value)) return false;
  if (!/[A-Za-z0-9&]/.test(trimmed)) return false;

  const blockText = block.join("\n");
  const hasBranchingBracketRow = block.some(
    (blockLine) => (blockLine.match(/\[[^\]]{2,}\]/g) || []).length >= 2
  );
  const hasTitleBracket = /\[[^\]]{4,}\]/.test(blockText);
  const hasConnectors = /[+|<>^v-]{2,}/.test(blockText);

  return hasConnectors && (hasBranchingBracketRow || hasTitleBracket);
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isFenceLine(line)) {
      flushBlock();
      output.push(line);
      inFence = !inFence;
      continue;
    }

    if (!inFence && isMarkdownDiagramHeading(line)) {
      const label = getMarkdownDiagramHeadingLabel(line);
      const stepLines = collectSimpleStepFlowLines(lines, index + 1);
      const normalizedSteps = getNormalizedDiagramLines(stepLines);

      if (parseSimpleStepFlowDiagram(normalizedSteps)) {
        flushBlock();

        if (output.length > 0 && output[output.length - 1] !== "") {
          output.push("");
        }

        output.push("```reader-diagram");

        if (label) {
          output.push(`@label ${label}`);
        }

        output.push(...normalizedSteps);
        output.push("```");
        index += stepLines.length;

        while (index + 1 < lines.length && !lines[index + 1].trim()) {
          index += 1;
        }

        continue;
      }
    }

    if (!inFence && isSimpleStepFlowLabel(line)) {
      const stepLines = collectSimpleStepFlowLines(lines, index + 1);
      const normalizedSteps = getNormalizedDiagramLines(stepLines);

      if (
        normalizedSteps.length >= 2 &&
        parseSimpleStepFlowDiagram(
          getNormalizedDiagramLines([line.trim(), ...normalizedSteps])
        )
      ) {
        flushBlock();

        if (output.length > 0 && output[output.length - 1] !== "") {
          output.push("");
        }

        output.push("```reader-diagram");
        output.push(`@label ${line.trim()}`);
        output.push(...normalizedSteps);
        output.push("```");
        index += stepLines.length;

        while (index + 1 < lines.length && !lines[index + 1].trim()) {
          index += 1;
        }

        continue;
      }
    }

    if (
      !inFence &&
      block.length === 0 &&
      isDiagramHeadingLine(line) &&
      hasNearbyAsciiDiagramLine(lines, index)
    ) {
      block.push(line);
      continue;
    }

    if (!inFence && isAsciiDiagramLine(line)) {
      block.push(line);
      continue;
    }

    if (!inFence && isAsciiDiagramContinuationLine(line, block)) {
      block.push(line);
      continue;
    }

    flushBlock();
    output.push(line);
  }

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

function parseBoxedListDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);

  if (nonEmptyLines.filter(isBoxBorderLine).length < 2) return null;

  const segments = [];
  let current = [];
  let hasSeenBorder = false;

  nonEmptyLines.forEach((line) => {
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

  const cleanedSegments = segments
    .map((segment) => segment.map(cleanSegmentLine).filter(Boolean))
    .filter((segment) => segment.length > 0);

  if (cleanedSegments.length === 0) return null;

  let title = "";
  let items = [];

  if (cleanedSegments[0].length === 1 && cleanedSegments.length >= 2) {
    title = cleanedSegments[0][0];
    items = cleanedSegments.slice(1).flat();
  } else if (cleanedSegments[0].length >= 3) {
    title = cleanedSegments[0][0];
    items = cleanedSegments[0].slice(1);
  }

  title = String(title || "")
    .replace(/^\[|\]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  items = items
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => !isBoxBorderLine(item));

  const listLikeItems = items.filter((item) =>
    /^(\d+[).]\s+|[-*]\s+|[A-Za-z][^:]{2,70}:\s+|\[[^\]]{2,}\])/.test(item)
  );

  if (!title || items.length < 2) return null;
  if (listLikeItems.length < Math.ceil(items.length * 0.5)) return null;

  return {
    type: "boxed-list",
    title,
    items,
  };
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

function cleanGenericDiagramDetail(value = "") {
  return String(value || "")
    .replace(/[|+<>^v/\\-]+/g, " ")
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getGenericDiagramTitle(lines = []) {
  const firstLine = String(lines[0] || "").trim();

  if (!firstLine || isAsciiDiagramLine(firstLine)) return "";
  if (/^(Diagram|Flow Diagram|System Diagram|Process Flow|Architecture)$/i.test(firstLine)) {
    return firstLine;
  }

  return isDiagramHeadingLine(firstLine) ? firstLine.replace(/:\s*$/, "") : "";
}

function parseGenericBracketDiagram(lines = []) {
  const normalizedLines = getNormalizedDiagramLines(lines);
  const title = getGenericDiagramTitle(normalizedLines);
  const bodyLines = title ? normalizedLines.slice(1) : normalizedLines;
  const hasConnectors =
    hasConnectorLine(bodyLines) ||
    bodyLines.some((line) => /-{2,}>|<-{2,}|\+[-+]+\+/.test(line));

  if (!hasConnectors) return null;

  let nodeRows = bodyLines
    .map((line, index) => ({
      index,
      line,
      nodes: getBracketNodes(line),
    }))
    .filter((row) => row.nodes.length > 0);

  if (nodeRows.length < 2) return null;

  const firstNodeAsTitle =
    !title &&
    nodeRows[0].nodes.length === 1 &&
    nodeRows.slice(1).some((row) => row.nodes.length >= 2);
  const diagramTitle = firstNodeAsTitle
    ? nodeRows[0].nodes[0].label
    : title || "Diagram";

  if (firstNodeAsTitle) {
    nodeRows = nodeRows.slice(1);
  }

  if (nodeRows.length < 1) return null;

  const rows = nodeRows.map((row, rowIndex) => {
    const nextNodeRowIndex =
      nodeRows[rowIndex + 1]?.index ?? Number.POSITIVE_INFINITY;
    const boundaries = row.nodes.map((node, index) => {
      const previousCenter = row.nodes[index - 1]?.center ?? 0;
      const nextCenter =
        row.nodes[index + 1]?.center ?? Number.POSITIVE_INFINITY;

      return {
        start: index === 0 ? 0 : Math.floor((previousCenter + node.center) / 2),
        end:
          index === row.nodes.length - 1
            ? Number.POSITIVE_INFINITY
            : Math.ceil((node.center + nextCenter) / 2),
      };
    });
    const details = row.nodes.map((node, index) => {
      const sameLineDetail = cleanGenericDiagramDetail(
        row.line.slice(
          node.end,
          row.nodes[index + 1]?.start ?? undefined
        )
      );

      return sameLineDetail && /[A-Za-z0-9]/.test(sameLineDetail)
        ? [sameLineDetail]
        : [];
    });

    bodyLines
      .slice(row.index + 1, nextNodeRowIndex)
      .filter((line) => line.trim() && !isConnectorOnlyLine(line))
      .forEach((line) => {
        boundaries.forEach((boundary, index) => {
          const segment = cleanGenericDiagramDetail(
            line.slice(
              boundary.start,
              boundary.end === Infinity ? undefined : boundary.end
            )
          );

          if (segment && /[A-Za-z0-9]/.test(segment)) {
            details[index].push(segment);
          }
        });
      });

    return {
      nodes: row.nodes.map((node, index) => ({
        label: node.label,
        detail: Array.from(new Set(details[index])).join("\n"),
      })),
    };
  });

  const uniqueLabels = new Set(
    rows.flatMap((row) => row.nodes.map((node) => node.label))
  );

  if (uniqueLabels.size < 2) return null;

  return {
    type: "generic-flow",
    title: diagramTitle,
    rows,
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

function cleanNestedBoxLine(line = "") {
  return String(line || "")
    .replace(/^\s*\|\s?/, "")
    .replace(/\s?\|\s*$/, "")
    .trim()
    .replace(/^\|\s?/, "")
    .replace(/\s?\|$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detailFromBracketNodes(line = "") {
  const nodes = getBracketNodes(line);

  if (!nodes.length) return cleanSegmentLine(line);

  return nodes
    .map((node) => {
      const after = line
        .slice(node.end)
        .split("[")[0]
        .replace(/^\s*\((.*)\)\s*$/, "$1")
        .trim();

      return after ? `${node.label}: ${after}` : node.label;
    })
    .join("\n");
}

function parseNestedArchitectureDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeDiagramText);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());

  if (nonEmptyLines.filter(isBoxBorderLine).length < 2) return null;

  const allBorderIndexes = normalizedLines
    .map((line, index) => ({
      index,
      line: cleanNestedBoxLine(line),
    }))
    .filter((entry) => isBoxBorderLine(entry.line))
    .map((entry) => entry.index);
  const innerBorderIndexes = allBorderIndexes.slice(1, -1);

  if (innerBorderIndexes.length < 4) return null;

  const title =
    normalizedLines
      .slice(1)
      .map(cleanNestedBoxLine)
      .find((line) => line && !isBoxBorderLine(line)) || "Architecture";
  const layers = [];

  for (let index = 0; index < innerBorderIndexes.length - 1; index += 1) {
    const start = innerBorderIndexes[index];
    const end = innerBorderIndexes[index + 1];
    const segment = normalizedLines
      .slice(start + 1, end)
      .map(cleanNestedBoxLine)
      .filter(Boolean)
      .filter((line) => !isBoxBorderLine(line));

    if (segment.length === 0) continue;

    const label = segment[0];
    const detail = segment
      .slice(1)
      .map(detailFromBracketNodes)
      .filter(Boolean)
      .join("\n");

    if (label && !layers.some((layer) => layer.label === label)) {
      layers.push({ label, detail });
    }
  }

  if (layers.length < 2) return null;

  return {
    type: "architecture",
    title,
    layers,
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

function parseMarkdownPipeTableDiagram(lines = []) {
  const nonEmptyLines = getNormalizedDiagramLines(lines);
  const pipeLines = nonEmptyLines.filter((line) => line.includes("|"));

  if (pipeLines.length < 2) return null;

  const isSeparator = (line) =>
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
  const separatorIndex = nonEmptyLines.findIndex(isSeparator);

  if (separatorIndex < 1) return null;

  const splitRow = (line) => {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => cell.trim());
  };

  const header = splitRow(nonEmptyLines[separatorIndex - 1]);
  const rows = nonEmptyLines
    .slice(separatorIndex + 1)
    .filter((line) => line.includes("|") && !isSeparator(line))
    .map(splitRow)
    .filter((row) => row.some((cell) => cell));

  if (header.length < 2 || !rows.length) return null;

  return {
    type: "table",
    title: "",
    header,
    rows,
  };
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
  const populatedColumnIndexes = Array.from(
    { length: columnCount },
    (_, index) => index
  ).filter((columnIndex) =>
    paddedRows.some((row) => String(row[columnIndex] || "").trim())
  );

  if (populatedColumnIndexes.length < 2) return null;

  const compactRows = paddedRows.map((row) =>
    populatedColumnIndexes.map((columnIndex) => row[columnIndex])
  );

  return {
    type: "table",
    header: compactRows[0],
    rows: compactRows.slice(1),
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

function isSystemHeading(line = "") {
  return /^[A-Z0-9][A-Za-z0-9\s/()&.-]{5,}:\s*$/.test(String(line || "").trim());
}

function getPipeBoxLabels(line = "") {
  const parts = String(line || "")
    .split("|")
    .map((part) =>
      part
        .replace(/\+[-=]+>?/g, " ")
        .replace(/[-=]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((part) => /[A-Za-z]{3,}/.test(part));

  return parts.filter((part) => !/^(v|Deposits|Loans)$/i.test(part));
}

function cleanSystemLabel(value = "") {
  return String(value || "")
    .replace(/[+|]/g, " ")
    .replace(/<-{2,}|-{2,}>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getParentheticalDetails(line = "") {
  return Array.from(String(line || "").matchAll(/\(([^)]{4,})\)/g)).map((match) =>
    match[1].trim()
  );
}

function extractBoxConnectorLabels(line = "") {
  const parts = String(line || "")
    .split(/\+-+\+/)
    .map(cleanSystemLabel)
    .filter((part) => /[A-Za-z]{3,}/.test(part));

  return parts.filter((part) => !/^(v)$/i.test(part));
}

function parsePipeBoxRow(line = "", connectorLine = "") {
  const labels = getPipeBoxLabels(line).map(cleanSystemLabel).filter(Boolean);

  if (labels.length < 2) return null;

  return {
    nodes: labels.map((label) => ({ label, detail: "" })),
    connectors: extractBoxConnectorLabels(connectorLine).slice(0, labels.length - 1),
  };
}

function parseArrowSystemRow(line = "", detailLine = "") {
  const cleanLine = cleanSegmentLine(line).replace(/\+$/g, "").trim();

  if (!/(?:-{2,}>|<-{2,})/.test(cleanLine)) return null;

  const labels = cleanLine
    .split(/(?:<-{2,}|-{2,}>)/)
    .map(cleanSystemLabel)
    .filter((label) => /[A-Za-z0-9]{2,}/.test(label))
    .filter((label) => !/^(v|Message)$/i.test(label));

  if (labels.length < 2) return null;

  const details = getParentheticalDetails(detailLine);

  return {
    nodes: labels.map((label, index) => ({
      label,
      detail: details[index] || "",
    })),
    connectors: [],
  };
}

function parseSpacedSystemRow(line = "", detailLine = "") {
  const cleanLine = cleanSegmentLine(line);

  if (/(?:-{2,}>|<-{2,}|\+[-=]+\+|\|)/.test(cleanLine)) return null;

  const labels = cleanLine
    .split(/\s{3,}/)
    .map(cleanSystemLabel)
    .filter((label) => /[A-Za-z0-9]{2,}/.test(label));

  if (labels.length < 2 || labels.length > 4) return null;
  if (!/(?:-{2,}>|<-{2,})/.test(detailLine)) return null;

  const details = getParentheticalDetails(detailLine);

  return {
    nodes: labels.map((label, index) => ({
      label,
      detail: details[index] || "",
    })),
    connectors: Array.from({ length: labels.length - 1 }, () => "->"),
  };
}

function parseSystemRows(lines = []) {
  const rows = [];
  const notes = [];
  const consumedDetailIndexes = new Set();

  lines.forEach((line, index) => {
    if (consumedDetailIndexes.has(index)) return;

    const trimmed = line.trim();
    const previousLine = lines[index - 1] || "";
    const nextLine = lines[index + 1] || "";
    const spacedRow = parseSpacedSystemRow(trimmed, nextLine);

    if (spacedRow) {
      rows.push(spacedRow);
      consumedDetailIndexes.add(index + 1);
      return;
    }

    const arrowRow = parseArrowSystemRow(trimmed, nextLine);

    if (arrowRow) {
      rows.push(arrowRow);
      if (getParentheticalDetails(nextLine).length) {
        consumedDetailIndexes.add(index + 1);
      }
      return;
    }

    const pipeRow = parsePipeBoxRow(trimmed, previousLine);

    if (pipeRow) {
      rows.push(pipeRow);
      return;
    }

    getParentheticalDetails(trimmed).forEach((note) => {
      if (!notes.includes(note)) notes.push(note);
    });
  });

  return { rows, notes };
}

function parseSystemFlowSection(title = "", sectionLines = []) {
  const normalized = getNormalizedDiagramLines(sectionLines);
  const { rows, notes } = parseSystemRows(normalized);
  const boxes = [];

  rows.forEach((row) => {
    row.nodes.forEach((node) => {
      if (!boxes.includes(node.label)) boxes.push(node.label);
    });
  });

  if (boxes.length < 2) {
    normalized.forEach((line) => {
      getBracketNodes(line).forEach((node) => {
        if (!boxes.includes(node.label)) boxes.push(node.label);
      });

      getPipeBoxLabels(line).forEach((label) => {
        if (!boxes.includes(label)) boxes.push(label);
      });
    });
  }

  if (boxes.length < 2) return null;

  const detailLines = normalized
    .filter((line) => !isBoxBorderLine(line))
    .map((line) =>
      line
        .replace(/\[[^\]]+\]/g, " ")
        .replace(/[+\-|<>^v/\\]+/g, " ")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((line) => /[A-Za-z]{3,}/.test(line));

  return {
    title: title.replace(/:\s*$/, ""),
    rows,
    notes,
    nodes: boxes.map((label, index) => ({
      label,
      detail: index === 0 ? [...detailLines, ...notes].join("\n") : "",
    })),
  };
}

function isBoxedSystemTitle(line = "") {
  const cleanLine = cleanNestedBoxLine(line);

  if (!/[A-Za-z]{3,}/.test(cleanLine)) return false;
  if (/(?:-{2,}>|<-{2,}|\+[-=]+\+|\|)/.test(cleanLine)) return false;

  return (
    /\b(SYSTEM|ARCHITECTURE|LEDGER|NETWORK|MODEL|PROCESS|SWIFT|CBDC|mBRIDGE)\b/i.test(
      cleanLine
    ) && cleanLine.length <= 72
  );
}

function parseBoxedSystemComparisonDiagram(lines = []) {
  const normalized = getNormalizedDiagramLines(lines);
  const sections = [];
  let currentTitle = "";
  let currentLines = [];

  const flush = () => {
    if (!currentTitle || currentLines.length === 0) return;
    const section = parseSystemFlowSection(currentTitle, currentLines);
    if (section) sections.push(section);
  };

  normalized.forEach((line) => {
    const cleaned = cleanNestedBoxLine(line);

    if (!cleaned || isBoxBorderLine(cleaned)) return;

    if (isBoxedSystemTitle(cleaned)) {
      flush();
      currentTitle = cleaned;
      currentLines = [];
      return;
    }

    if (currentTitle) currentLines.push(cleaned);
  });

  flush();

  if (sections.length < 2) return null;

  return {
    type: "system-comparison",
    sections,
  };
}

function parseSystemComparisonDiagram(lines = []) {
  const normalized = getNormalizedDiagramLines(lines);
  const sections = [];
  let currentTitle = "";
  let currentLines = [];

  const flush = () => {
    if (!currentTitle || currentLines.length === 0) return;
    const section = parseSystemFlowSection(currentTitle, currentLines);
    if (section) sections.push(section);
  };

  normalized.forEach((line) => {
    if (isSystemHeading(line)) {
      flush();
      currentTitle = line.trim();
      currentLines = [];
      return;
    }

    if (currentTitle) currentLines.push(line);
  });

  flush();

  if (sections.length < 2) return null;

  return {
    type: "system-comparison",
    sections,
  };
}

export function getReaderDiagramLines(lines = []) {
  return getNormalizedDiagramLines(lines);
}

export function parseTreeHubDiagram(lines = []) {
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
    type: "process",
    title: "",
    nodes,
    connectors: [],
  };
}

export function parseReaderDiagram(lines = []) {
  return (
    parseMarkdownPipeTableDiagram(lines) ||
    parseTreeHubDiagram(lines) ||
    parseSystemComparisonDiagram(lines) ||
    parseBoxedSystemComparisonDiagram(lines) ||
    parseNestedArchitectureDiagram(lines) ||
    parseBoxedListDiagram(lines) ||
    parseStackDiagram(lines) ||
    parseSimpleStepFlowDiagram(lines) ||
    parseProcessDiagram(lines) ||
    parseTableDiagram(lines) ||
    parseGenericBracketDiagram(lines) ||
    parseFlowDiagram(lines) ||
    parseLinearFlowDiagram(lines) ||
    parseBadgeBlock(lines)
  );
}
export function parseBadgeBlock(lines = []) {
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

export { normalizeReaderMarkdown, extractDiagramLabelDirective };
