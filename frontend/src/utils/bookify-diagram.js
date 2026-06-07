function stripTitleNode(nodes = []) {
  const nextNodes = [...nodes];
  let title = "";

  if (nextNodes.length > 0) {
    const titleMatch = nextNodes[0].label?.match(/^Title:\s*(.+)$/i);

    if (titleMatch) {
      title = titleMatch[1].trim();
      nextNodes.shift();
    }
  }

  return { nodes: nextNodes, title };
}

function flattenSystemComparisonSections(sections = []) {
  return sections.map((section) => {
    const rows = section.rows?.length
      ? section.rows
      : [{ nodes: section.nodes || [] }];

    const detail = rows
      .flatMap((row) => row.nodes || [])
      .map((node) => [node.label, node.detail].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("\n");

    return {
      label: section.title,
      detail,
    };
  });
}

function flattenGenericFlowRows(rows = []) {
  return rows.flatMap((row) => row.nodes || []);
}

export function toBookifyDiagram(readerDiagram, label = "") {
  if (!readerDiagram) return null;

  const normalizedLabel = String(label || "").trim();

  if (readerDiagram.type === "table") {
    return {
      type: "table",
      title: normalizedLabel || readerDiagram.title || "Structured Table",
      header: readerDiagram.header || [],
      rows: readerDiagram.rows || [],
    };
  }

  if (readerDiagram.type === "boxed-list") {
    return {
      type: "boxed-list",
      title: normalizedLabel || readerDiagram.title || "Key Points",
      items: readerDiagram.items || [],
    };
  }

  if (readerDiagram.type === "system-comparison") {
    return {
      type: "flow",
      title: normalizedLabel || "System Comparison",
      nodes: flattenSystemComparisonSections(readerDiagram.sections || []),
    };
  }

  if (readerDiagram.type === "generic-flow") {
    return {
      type: "flow",
      title: normalizedLabel || readerDiagram.title || "Diagram",
      nodes: flattenGenericFlowRows(readerDiagram.rows || []),
    };
  }

  if (readerDiagram.type === "stack" || readerDiagram.type === "architecture") {
    return {
      type: "flow",
      title:
        normalizedLabel || readerDiagram.title || "Architecture",
      nodes: readerDiagram.layers || [],
    };
  }

  if (
    readerDiagram.type === "flow" ||
    readerDiagram.type === "linear" ||
    readerDiagram.type === "process"
  ) {
    const { nodes, title: parsedTitle } = stripTitleNode(readerDiagram.nodes || []);
    const defaultTitle =
      readerDiagram.type === "linear"
        ? "Process Flow"
        : readerDiagram.type === "process"
          ? "Diagram"
          : "Diagram";

    return {
      type: "flow",
      title: normalizedLabel || readerDiagram.title || parsedTitle || defaultTitle,
      nodes,
    };
  }

  if (readerDiagram.type === "badge") {
    return {
      type: "flow",
      title: normalizedLabel || readerDiagram.title || "Diagram",
      nodes: (readerDiagram.items || []).map((item) => ({
        label: item.label,
        detail: item.value,
      })),
    };
  }

  return null;
}

export function toBookifyPreDiagram(lines = [], label = "") {
  return {
    type: "pre",
    title: String(label || "").trim() || "Diagram",
    lines: lines.map((line) => String(line || "")),
  };
}
