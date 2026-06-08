import test from "node:test";
import assert from "node:assert/strict";
import {
  parseReaderDiagram,
  normalizeReaderMarkdown,
} from "./reader-diagram-parse.js";

test("parseReaderDiagram parses hub-and-spoke service trees", () => {
  const diagram = parseReaderDiagram([
    "                    ┌─── Authentication (e.g., Supabase Auth, NextAuth)",
    "                     │",
    "Your Application ───┼─── Database (e.g., Supabase DB, Neon PostgreSQL)",
  ]);

  assert.ok(diagram);
  assert.equal(diagram.type, "process");
  assert.ok(diagram.nodes.length >= 2);
});

test("parseReaderDiagram rejects recipe callouts", () => {
  const diagram = parseReaderDiagram([
    "**Moonlit Recipe**",
    "1 cup of moonlit sugar",
    "2 teaspoons of starlight flour",
    "3 drops of midnight oil",
  ]);

  assert.equal(diagram, null);
});

test("normalizeReaderMarkdown keeps blockquote recipe callouts as prose", () => {
  const source = [
    "I unfolded it carefully.",
    "",
    "> **Moonlit Recipe**",
    "> 1 cup of moonlit sugar",
    "> 2 teaspoons of starlight flour",
    "> 3 drops of midnight oil",
    "> Find the hidden key beneath the oven.",
  ].join("\n");

  const normalized = normalizeReaderMarkdown(source);

  assert.match(normalized, /> \*\*Moonlit Recipe\*\*/);
  assert.doesNotMatch(normalized, /```reader-diagram/);
});

test("normalizeReaderMarkdown keeps inline recipe callouts as prose", () => {
  const source = [
    "**Moonlit Recipe**",
    "1 cup of moonlit sugar",
    "2 teaspoons of starlight flour",
    "3 drops of midnight oil",
  ].join("\n");

  const normalized = normalizeReaderMarkdown(source);

  assert.equal(normalized, source);
  assert.doesNotMatch(normalized, /```reader-diagram/);
});
