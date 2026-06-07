import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const mongoose = require("mongoose");
const BOOK_ID = process.argv[2] || "6a1515e8744abaa018a74109";
const CH = Number(process.argv[3] || 1) - 1;

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../../backend/.env.local"), "utf8");
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnv();
await mongoose.connect(process.env.DB_URI);
const book = await mongoose.connection.db
  .collection("books")
  .findOne({ _id: new mongoose.Types.ObjectId(BOOK_ID) });
const ch = (book.chapters || [])[CH];
console.log("TITLE:", ch?.title);
console.log("OPENING:\n", ch?.content?.slice(0, 500));
const fence = ch?.content?.indexOf("```") ?? -1;
if (fence >= 0) {
  console.log("\nFIRST FENCE:\n", ch.content.slice(fence, fence + 700));
}
await mongoose.disconnect();
