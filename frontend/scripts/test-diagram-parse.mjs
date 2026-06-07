import { parseReaderDiagram } from "../src/utils/reader-diagram-parse.js";

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

const result = parseReaderDiagram(content.split("\n"));
console.log(result ? JSON.stringify(result, null, 2) : "PARSE FAILED");
