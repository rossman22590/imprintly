import { ReaderMarkdownContent } from "../../utils/reader-diagrams";

function MarkdownPreview({
  className = "",
  emptyMessage = "No content yet.",
  source = "",
  style,
}) {
  if (!String(source || "").trim()) {
    return (
      <p className="text-slate-400 italic text-center py-12">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={className}>
      <ReaderMarkdownContent
        source={source}
        fontFamily={style?.fontFamily}
        fontSize={style?.fontSize || 16}
        colorMode="light"
      />
    </div>
  );
}

export default MarkdownPreview;
