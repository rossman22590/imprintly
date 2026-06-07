import test from "node:test";
import assert from "node:assert/strict";
import { toBookifyDiagram } from "./bookify-diagram.js";

test("toBookifyDiagram maps process diagrams to epub flow shape", () => {
  const diagram = toBookifyDiagram(
    {
      type: "process",
      nodes: [
        { label: "Title: Star Muffin Flow", detail: "" },
        { label: "Gather moon flour", detail: "" },
        { label: "Bake", detail: "" },
      ],
    },
    "Bakery Process"
  );

  assert.equal(diagram.type, "flow");
  assert.equal(diagram.title, "Bakery Process");
  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    ["Gather moon flour", "Bake"]
  );
});
