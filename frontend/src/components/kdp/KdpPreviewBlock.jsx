import KdpPreviewDiagram from "./KdpPreviewDiagram";
import "../../styles/bookify-diagram.css";


export default function KdpPreviewBlock({
  block,
  paragraphIndent = "1.35",
  showParagraphIndent = false,
  diagramCompact = false,
  diagramFullPage = false,
  baseFontSize = 12,
}) {
  if (!block) return null;

  if (block.type === "diagram") {
    return (
      <KdpPreviewDiagram
        content={block.content}
        language={block.language}
        label={block.label}
        compact={diagramCompact}
        fullPage={diagramFullPage}
      />
    );
  }

  const bodySize = Number(baseFontSize) || 12;

  if (block.type === "code") {
    const codeSizePoints = Math.max(7.5, bodySize - 2);
    const codeEmSize = `${(codeSizePoints / bodySize).toFixed(4)}em`;

    return (
      <div className="not-prose my-[0.45em] w-full">
        {block.label ? (
          <p className="m-0 mb-[0.3em] text-center text-[0.82em] font-semibold text-slate-700">
            {block.label}
          </p>
        ) : null}
        <pre className="m-0 max-w-full whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-[0.65em] font-mono leading-[1.22] text-slate-900" style={{ fontSize: codeEmSize }}>
          <code>{String(block.content || "").replace(/\n$/, "")}</code>
        </pre>
      </div>
    );
  }

  if (block.type === "table") {
    const compactTable = (block.rows || []).length > 6 || (block.header || []).length > 3;
    const tableSizePoints = Math.max(8.2, bodySize * (compactTable ? 0.76 : 0.82));
    const tableEmSize = `${(tableSizePoints / bodySize).toFixed(4)}em`;

    return (
      <figure className="bookify-diagram-host not-prose my-[0.45em] w-full overflow-hidden">
        <table className="bookify-table w-full" style={{ fontSize: tableEmSize }}>
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
    const headingSizes = {
      1: Math.max(16, Math.round(bodySize * 1.55)),
      2: Math.max(14, Math.round(bodySize * 1.35)),
      3: Math.max(13, Math.round(bodySize * 1.18)),
      4: bodySize + 1,
      5: bodySize,
      6: bodySize - 0.5,
    };
    const fontSizePoints = headingSizes[block.level] || Math.max(13, Math.round(bodySize * 1.18));
    const headingEmSize = `${(fontSizePoints / bodySize).toFixed(4)}em`;

    return (
      <p
        className="m-0 mb-[0.55em] text-center font-bold leading-tight"
        style={{ fontSize: headingEmSize }}
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
