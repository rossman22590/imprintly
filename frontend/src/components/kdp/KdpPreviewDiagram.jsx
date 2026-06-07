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
  compact = false,
  fullPage = false,
  preformatted = false,
}) {
  const code = String(content || "").replace(/\n$/, "");
  const lines = code.split("\n");
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const shouldTryDiagram =
    !preformatted &&
    (normalizedLanguage === "reader-diagram" ||
      ["text", "txt", "plain", "diagram", "flow", ""].includes(
        normalizedLanguage
      ));
  const readerDiagram = shouldTryDiagram ? parseReaderDiagram(lines) : null;
  const bookifyDiagram =
    toBookifyDiagram(readerDiagram, label) ||
    (shouldTryDiagram ? toBookifyPreDiagram(lines, label) : null);

  if (!shouldTryDiagram) {
    return (
      <figure
        className={`bookify-diagram-host not-prose w-full max-w-full ${
          fullPage ? "bookify-diagram-host--full-page my-0" : "my-[0.75em]"
        }`}
      >
        {label ? (
          <figcaption className="mb-[0.5em] text-center text-[0.82em] font-semibold text-slate-700">
            {label}
          </figcaption>
        ) : null}
        <pre className="max-w-full rounded-md border border-slate-200 bg-slate-50 p-[0.7em] font-mono text-[0.64em] leading-[1.22] break-words whitespace-pre-wrap text-slate-900">
          <code>{code}</code>
        </pre>
      </figure>
    );
  }

  if (!bookifyDiagram) {
    return (
      <figure
        className={`bookify-diagram-host not-prose w-full max-w-full ${
          fullPage ? "bookify-diagram-host--full-page my-0" : "my-[0.35em]"
        }`}
      >
        {label ? (
          <figcaption className="mb-[0.4em] text-center text-[0.82em] font-semibold text-slate-700">
            {label}
          </figcaption>
        ) : null}
        <pre className="max-w-full rounded-md border border-slate-200 bg-slate-50 p-[0.68em] font-mono text-[0.62em] leading-[1.2] break-words whitespace-pre-wrap text-slate-900">
          <code>{code}</code>
        </pre>
      </figure>
    );
  }

  const hostClassName = compact
    ? "bookify-diagram-host not-prose my-[0.15em] w-full max-w-full overflow-visible [&_.bookify-diagram]:!my-0 [&_.bookify-diagram]:!p-[0.36em] [&_.bookify-diagram]:!text-[0.72em] [&_.bookify-node]:!my-[0.32em] [&_.bookify-node]:!py-[0.2em] [&_.bookify-node]:!px-[0.34em] [&_.bookify-arrow]:!my-0"
    : `bookify-diagram-host not-prose w-full max-w-full overflow-visible [&_.bookify-diagram]:!my-0 [&_.bookify-diagram]:!w-full ${
        fullPage
          ? "bookify-diagram-host--full-page my-0 [&_.bookify-diagram]:!p-[0.78em] [&_.bookify-diagram]:!text-[1.02em] [&_.bookify-node]:!py-[0.52em] [&_.bookify-node]:!px-[0.68em]"
          : "my-[0.35em] [&_.bookify-diagram]:!p-[0.58em] [&_.bookify-diagram]:!text-[0.82em] [&_.bookify-node]:!py-[0.38em] [&_.bookify-node]:!px-[0.52em]"
      }`;

  return (
    <div className={hostClassName}>
      <BookifyDiagram diagram={bookifyDiagram} />
    </div>
  );
}
