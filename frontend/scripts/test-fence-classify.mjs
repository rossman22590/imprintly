import { createRequire } from "module";
const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const {
  isDedicatedDiagramFence,
  shouldUseDedicatedDiagramPage,
  estimateDiagramBlockLines,
} = require("../backend/src/utils/kdp-markdown-blocks.js");

const content = `[ Natural Language / AI Prompts ]  <-- You are here
               │
               ▼
   [ High-Level Languages ]       <-- Python, JavaScript, Ruby
               │
               ▼
   [ Low-Level Languages ]        <-- C, Assembly
               │
               ▼
      [ Machine Language ]        <-- 1s and 0s (Binary)`;

const tm = { linesPerPage: 33, charsPerLine: 72 };
console.log("dedicated fence:", isDedicatedDiagramFence("", content));
console.log("dedicated page:", shouldUseDedicatedDiagramPage("", content, tm));
console.log("lines:", estimateDiagramBlockLines(content, "", tm));
