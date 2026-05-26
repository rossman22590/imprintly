const test = require("node:test");
const assert = require("node:assert/strict");
const {
  __private,
  generateContinuityReportPdf,
} = require("./continuity-report-pdf.generator");

test("collects markdown table rows for continuity reports", () => {
  const MarkdownIt = require("markdown-it");
  const md = new MarkdownIt({ html: false });
  const tokens = md.parse(
    [
      "| Issue Type | Description | Recommended Fix |",
      "|------------|-------------|-----------------|",
      "| **Timeline Gap** | Chapters 2-4 missing. | Update the bible. |",
    ].join("\n"),
    {}
  );
  const tableIndex = tokens.findIndex((token) => token.type === "table_open");
  const { rows } = __private.collectTableRows(tokens, tableIndex);

  assert.deepEqual(rows, [
    ["Issue Type", "Description", "Recommended Fix"],
    ["**Timeline Gap**", "Chapters 2-4 missing.", "Update the bible."],
  ]);
});

test("generates a markdown-rendered continuity report PDF buffer", async () => {
  const buffer = await generateContinuityReportPdf(
    {
      title: "Hiring People",
      author: "Bookify",
    },
    [
      '## Continuity Report - "Hiring People"',
      "",
      "| Issue Type | Description | Location | Conflict | Recommended Fix |",
      "|------------|-------------|----------|----------|-----------------|",
      "| **Character Drift** | Canonical roles are absent. | Entire manuscript. | Characters bible. | Add recurring examples. |",
      "",
      "### Summary",
      "The manuscript largely adheres to canon, with a few gaps.",
    ].join("\n")
  );

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
