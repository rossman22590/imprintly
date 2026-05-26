const {
  getChapterMarkdownForExport,
  rewriteMarkdownImageUrls,
} = require("./export-markdown");

function escapeTitle(text = "") {
  return String(text).replace(/\r?\n/g, " ").trim();
}

function makeAbsoluteImageUrl(url = "") {
  const markdown = rewriteMarkdownImageUrls(`![](${url})`);
  const match = markdown.match(/\(([^)]+)\)/);

  return match?.[1] || url;
}

function generateMarkdown(book) {
  const lines = [];

  lines.push(`# ${escapeTitle(book.title)}`);
  lines.push("");

  if (book.coverImage) {
    lines.push(
      `![${escapeTitle(book.title) || "Book cover"}](${makeAbsoluteImageUrl(
        book.coverImage
      )})`
    );
    lines.push("");
  }

  if (book.subtitle) {
    lines.push(`## ${escapeTitle(book.subtitle)}`);
    lines.push("");
  }

  lines.push(`by ${escapeTitle(book.author)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  (book.chapters || []).forEach((chapter, index) => {
    lines.push(`# ${escapeTitle(chapter.title || `Chapter ${index + 1}`)}`);
    lines.push("");

    const chapterMarkdown = getChapterMarkdownForExport(chapter, {
      absoluteImageUrls: true,
    }).trim();

    if (chapterMarkdown) {
      lines.push(chapterMarkdown);
    }

    lines.push("");
  });

  return lines.join("\n");
}

module.exports = { generateMarkdown };
