const test = require("node:test");
const assert = require("node:assert/strict");
const { isDedicatedDiagramFence } = require("./kdp-markdown-blocks");
const { parseExportDiagram, renderDiagramHtml } = require("./export-diagram");

test("parseExportDiagram matches PDF fence classification for code blocks", () => {
  assert.equal(parseExportDiagram("function test() {}", "javascript"), null);
  assert.equal(parseExportDiagram("node -v\nnpm -v", "bash"), null);
  assert.equal(
    parseExportDiagram(
      "System: You are an expert assistant.\nPlease write a PRD.",
      "text"
    ),
    null
  );
});

test("parseExportDiagram parses tree diagrams for EPUB and PDF parity", () => {
  const diagram = parseExportDiagram(
    [
      "                    ┌─── Authentication (e.g., Supabase Auth, NextAuth)",
      "                     │",
      "Your Application ───┼─── Database (e.g., Supabase DB, Neon PostgreSQL)",
    ].join("\n"),
    "text"
  );

  assert.ok(diagram);
  assert.equal(diagram.type, "flow");
  assert.ok(diagram.nodes.length >= 2);
  assert.match(renderDiagramHtml(diagram), /bookify-diagram/);
});

test("parseExportDiagram preserves diagram labels for reflowable exports", () => {
  const diagram = parseExportDiagram(
    ["@label Service Map", "[ Node A ]", "  v", "[ Node B ]"].join("\n"),
    "text"
  );

  assert.ok(diagram);
  assert.equal(diagram.label, "Service Map");
  assert.match(renderDiagramHtml(diagram), /Service Map/);
});

test("dedicated diagram fences stay aligned between export parsers", () => {
  const sample = ["[ Node A ]", "  v", "[ Node B ]"].join("\n");

  assert.equal(isDedicatedDiagramFence("text", sample), true);
  assert.ok(parseExportDiagram(sample, "text"));
});
