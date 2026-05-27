import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import { resolveImageUrl } from "../../utils/api-endpoints";

const markdownComponents = {
  a({ href = "", children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  img({ alt = "", src = "" }) {
    const resolvedSrc = resolveImageUrl(src);

    if (!resolvedSrc) return null;

    return (
      <figure className="my-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <img
          src={resolvedSrc}
          alt={alt}
          className="w-full max-h-[520px] object-contain bg-white"
          loading="lazy"
        />
        {alt ? (
          <figcaption className="px-3 py-2 text-xs text-slate-500">
            {alt}
          </figcaption>
        ) : null}
      </figure>
    );
  },
};

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
    <MDEditor.Markdown
      source={source}
      rehypePlugins={[[rehypeSanitize]]}
      components={markdownComponents}
      className={className}
      style={style}
    />
  );
}

export default MarkdownPreview;
