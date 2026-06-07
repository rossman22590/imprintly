const MARKDOWN_IMAGE_PATTERN = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;

function clampIndex(index, length) {
  return Math.max(0, Math.min(Number(index) || 0, length));
}

function getImageUrlPath(url = "") {
  const value = String(url || "").replace(/\s+/g, "").trim();

  if (!value) return "";

  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

function getLineBounds(content, start, end) {
  const lineStart = content.lastIndexOf("\n", start - 1) + 1;
  const nextLineBreak = content.indexOf("\n", end);
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;

  return { lineEnd, lineStart };
}

export function getMarkdownImages(content = "") {
  const source = String(content || "");

  return Array.from(source.matchAll(MARKDOWN_IMAGE_PATTERN), (match) => {
    const markdown = match[0];
    const start = match.index || 0;

    return {
      alt: match[1] || "",
      end: start + markdown.length,
      markdown,
      start,
      url: match[2] || "",
    };
  });
}

export function findMarkdownImageAtSelection(
  content = "",
  selectionStart = 0,
  selectionEnd = selectionStart
) {
  const source = String(content || "");
  const start = clampIndex(selectionStart, source.length);
  const end = clampIndex(selectionEnd, source.length);
  const selectionFrom = Math.min(start, end);
  const selectionTo = Math.max(start, end);
  const isCursor = selectionFrom === selectionTo;

  return (
    getMarkdownImages(source).find((image) => {
      if (isCursor) {
        if (selectionFrom >= image.start && selectionFrom <= image.end) {
          return true;
        }

        const { lineEnd, lineStart } = getLineBounds(
          source,
          image.start,
          image.end
        );
        const lineText = source.slice(lineStart, lineEnd);

        return (
          lineText.trim() === image.markdown &&
          selectionFrom >= lineStart &&
          selectionFrom <= lineEnd
        );
      }

      return selectionFrom < image.end && selectionTo > image.start;
    }) || null
  );
}

export function removeMarkdownImage(content = "", image) {
  const source = String(content || "");

  if (
    !image ||
    typeof image.start !== "number" ||
    typeof image.end !== "number"
  ) {
    return source;
  }

  const start = clampIndex(image.start, source.length);
  const end = Math.max(start, clampIndex(image.end, source.length));
  const markdown = source.slice(start, end);

  if (!markdown || (image.markdown && markdown !== image.markdown)) {
    return source;
  }

  const { lineEnd, lineStart } = getLineBounds(source, start, end);
  const lineText = source.slice(lineStart, lineEnd);
  let removeStart = start;
  let removeEnd = end;

  if (lineText.trim() === markdown) {
    removeStart = lineStart;
    removeEnd = lineEnd;

    if (removeEnd < source.length) {
      removeEnd += source[removeEnd] === "\r" && source[removeEnd + 1] === "\n"
        ? 2
        : 1;
    } else if (removeStart > 0 && source[removeStart - 1] === "\n") {
      removeStart -= source[removeStart - 2] === "\r" ? 2 : 1;
    }
  }

  let nextContent = `${source.slice(0, removeStart)}${source.slice(removeEnd)}`;

  if (removeStart === 0) {
    nextContent = nextContent.replace(/^(?:\r?\n)+/, "");
  }

  if (removeEnd >= source.length) {
    nextContent = nextContent.replace(/(?:\r?\n)+$/, "");
  }

  return nextContent.replace(/(?:\r?\n){3,}/g, "\n\n");
}

export function removeImageAssetForMarkdown(images = [], image) {
  const targetPath = getImageUrlPath(image?.url);

  if (!targetPath || !Array.isArray(images)) return images;

  return images.filter((asset) => getImageUrlPath(asset?.url) !== targetPath);
}
