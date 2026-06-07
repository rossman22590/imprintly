import KdpPreviewDiagram from "./KdpPreviewDiagram";
import "../../styles/bookify-diagram.css";

const HEADING_SIZES = {
  1: "1.22em",
  2: "1.12em",
  3: "1.05em",
  4: "1em",
  5: "0.95em",
  6: "0.9em",
};

export default function KdpPreviewBlock({
  block,
  paragraphIndent = "1.35",
  showParagraphIndent = false,
  diagramCompact = false,
}) {
  if (!block) return null;

  if (block.type === "diagram" || block.type === "code") {
    return (
      <KdpPreviewDiagram
        content={block.content}
        language={block.language}
        label={block.label}
        compact={diagramCompact}
      />
    );
  }

  if (block.type === "table") {
    return (
      <figure className="bookify-diagram-host not-prose my-[0.45em] w-full overflow-hidden">
        <table className="bookify-table w-full text-[0.74em]">
          {(block.header || []).length > 0 && (
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={`${cellIndex}-${cell}`}>{cell}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {(block.rows || []).map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    );
  }

  if (block.type === "heading") {
    return (
      <p
        className="m-0 mb-[0.55em] text-center font-bold leading-tight"
        style={{ fontSize: HEADING_SIZES[block.level] || "1.05em" }}
      >
        {block.text}
      </p>
    );
  }

  if (block.type === "blockquote") {
    return (
      <p className="m-0 mb-[0.4em] border-l-2 border-slate-300 pl-[0.8em] italic leading-snug text-slate-700">
        {block.text}
      </p>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";

    return (
      <ListTag className="m-0 mb-[0.5em] list-outside pl-[1.35em] marker:text-slate-600">
        {(block.items || []).map((item, itemIndex) => (
          <li key={`${itemIndex}-${item.slice(0, 12)}`} className="mb-[0.2em]">
            {item}
          </li>
        ))}
      </ListTag>
    );
  }

  return (
    <p
      className="m-0 text-justify"
      style={{
        textIndent:
          showParagraphIndent && !block.continuation ? `${paragraphIndent}em` : "0",
      }}
    >
      {block.text}
    </p>
  );
}
