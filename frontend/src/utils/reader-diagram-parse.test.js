import test from "node:test";
import assert from "node:assert/strict";
import { parseReaderDiagram } from "./reader-diagram-parse.js";

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
