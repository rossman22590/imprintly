function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripChapterOpenerFromMarkdown(markdown, chapterIndex, chapterTitle) {
  const chapterNum = chapterIndex + 1;
  const titlePart = escapeRegExp(String(chapterTitle || "").trim());
  const openerPattern = new RegExp(
    `^#{0,6}\\s*Chapter\\s+${chapterNum}\\s*[:\\-–]?\\s*${titlePart}\\s*\\n+`,
    "im"
  );
  return String(markdown || "").replace(openerPattern, "");
}

const markdown = `# Chapter 1: Adopting the AI Builder Mindset

For decades, the path`;

const stripped = stripChapterOpenerFromMarkdown(
  markdown,
  0,
  "Adopting the AI Builder Mindset"
);
console.log("STRIPPED START:", JSON.stringify(stripped.slice(0, 80)));
console.log("REMOVED:", stripped.startsWith("For decades"));
