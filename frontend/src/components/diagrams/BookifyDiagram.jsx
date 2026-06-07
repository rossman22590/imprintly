import { Fragment } from "react";

function BookifyFlowDiagram({ diagram }) {
  const nodes = diagram.nodes || [];

  return (
    <figure className="bookify-diagram">
      <figcaption>{diagram.title || "Diagram"}</figcaption>
      <div className="bookify-flow">
        {nodes.map((node, index) => (
          <Fragment key={`${node.label}-${index}`}>
            <div className="bookify-node">
              <strong>{node.label}</strong>
              {node.detail ? <p>{node.detail}</p> : null}
            </div>
            {index < nodes.length - 1 ? (
              <div className="bookify-arrow">↓</div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </figure>
  );
}

function BookifyTableDiagram({ diagram }) {
  return (
    <figure className="bookify-diagram">
      <figcaption>{diagram.title || "Structured Table"}</figcaption>
      <table className="bookify-table">
        <thead>
          <tr>
            {(diagram.header || []).map((cell, index) => (
              <th key={`${cell}-${index}`}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(diagram.rows || []).map((row, rowIndex) => (
            <tr key={rowIndex}>
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

function BookifyBoxedListDiagram({ diagram }) {
  return (
    <figure className="bookify-diagram bookify-callout">
      <figcaption>{diagram.title || "Key Points"}</figcaption>
      <ol className="bookify-list">
        {(diagram.items || []).map((item, index) => {
          const match = String(item).match(/^\d+[).]\s*(.*)$/);
          return <li key={`${item}-${index}`}>{match ? match[1] : item}</li>;
        })}
      </ol>
    </figure>
  );
}

function BookifyPreDiagram({ diagram }) {
  return (
    <figure className="bookify-diagram">
      <figcaption>{diagram.title || "Diagram"}</figcaption>
      <pre>{(diagram.lines || []).join("\n")}</pre>
    </figure>
  );
}

export default function BookifyDiagram({ diagram }) {
  if (!diagram) return null;

  if (diagram.type === "table") {
    return <BookifyTableDiagram diagram={diagram} />;
  }

  if (diagram.type === "boxed-list") {
    return <BookifyBoxedListDiagram diagram={diagram} />;
  }

  if (diagram.type === "pre") {
    return <BookifyPreDiagram diagram={diagram} />;
  }

  if (diagram.type === "flow") {
    return <BookifyFlowDiagram diagram={diagram} />;
  }

  return null;
}
