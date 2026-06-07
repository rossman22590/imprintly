import BookifyDiagram from "../diagrams/BookifyDiagram";
import { parseReaderDiagram } from "../../utils/reader-diagrams";
import {
  toBookifyDiagram,
  toBookifyPreDiagram,
} from "../../utils/bookify-diagram";
import "../../styles/bookify-diagram.css";

export default function KdpPreviewDiagram({
  content = "",
  language = "",
  label = "",
}) {
  const code = String(content || "").replace(/\n$/, "");
  const lines = code.split("\n");
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const shouldTryDiagram =
    normalizedLanguage === "reader-diagram" ||
    ["text", "txt", "plain", "diagram", "flow", ""].includes(normalizedLanguage);
  const readerDiagram = shouldTryDiagram ? parseReaderDiagram(lines) : null;
  const bookifyDiagram =
    toBookifyDiagram(readerDiagram, label) ||
    (shouldTryDiagram ? toBookifyPreDiagram(lines, label) : null);

  if (!bookifyDiagram) return null;

  return (
    <div className="bookify-diagram-host not-prose">
      <BookifyDiagram diagram={bookifyDiagram} />
    </div>
  );
}
