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

  if (!shouldTryDiagram) {
    return (
      <figure className="bookify-diagram-host not-prose my-[0.75em] w-full max-w-full">
        {label ? (
          <figcaption className="mb-[0.5em] text-center text-[0.82em] font-semibold text-slate-700">
            {label}
          </figcaption>
        ) : null}
        <pre className="max-w-full rounded-lg border border-slate-200 bg-slate-50 p-[0.85em] font-mono text-[0.68em] leading-snug break-words whitespace-pre-wrap text-slate-900">
          <code>{code}</code>
        </pre>
      </figure>
    );
  }

  if (!bookifyDiagram) {
    return (
      <figure className="bookify-diagram-host not-prose my-[0.35em] w-full max-w-full">
        {label ? (
          <figcaption className="mb-[0.4em] text-center text-[0.82em] font-semibold text-slate-700">
            {label}
          </figcaption>
        ) : null}
        <pre className="max-w-full rounded-lg border border-slate-200 bg-slate-50 p-[0.75em] font-mono text-[0.62em] leading-snug break-words whitespace-pre-wrap text-slate-900">
          <code>{code}</code>
        </pre>
      </figure>
    );
  }

  const hostClassName = compact
    ? "bookify-diagram-host not-prose my-[0.35em] w-full max-h-[26cqh] overflow-hidden [&_.bookify-diagram]:!my-0 [&_.bookify-diagram]:!p-[0.5em] [&_.bookify-diagram]:!text-[0.84em] [&_.bookify-diagram]:origin-top [&_.bookify-diagram]:scale-[0.94] [&_.bookify-node]:!py-[0.35em] [&_.bookify-node]:!px-[0.5em] [&_.bookify-arrow]:!my-[0.08em]"
    : "bookify-diagram-host not-prose my-[0.35em] w-full max-h-[40cqh] overflow-hidden [&_.bookify-diagram]:!my-0 [&_.bookify-diagram]:!w-full [&_.bookify-diagram]:!max-h-full [&_.bookify-diagram]:!p-[0.65em] [&_.bookify-diagram]:!text-[0.9em] [&_.bookify-diagram]:origin-top [&_.bookify-node]:!py-[0.45em] [&_.bookify-node]:!px-[0.6em]";

  return (
    <div className={hostClassName}>
      <BookifyDiagram diagram={bookifyDiagram} />
    </div>
  );
}
