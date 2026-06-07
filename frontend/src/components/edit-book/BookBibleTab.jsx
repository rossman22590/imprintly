import { useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Check,
  Clock3,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  Network,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import Button from "../ui/Button";
import { resolveImageUrl } from "../../utils/api-endpoints";

const SOURCE_FILE_ACCEPT =
  ".pdf,.docx,.md,.markdown,.txt,.text,.html,.htm,.csv,.json,.rtf";
const SOURCE_FILE_LIMIT = 6;

const BIBLE_FIELDS = [
  {
    key: "source",
    label: "Source",
    icon: FileText,
    placeholder:
      "Uploaded source documents, original notes, source excerpts, constraints, or reference materials...",
  },
  {
    key: "characters",
    label: "Characters",
    icon: Users,
    placeholder:
      "Names, aliases, traits, voice, goals, relationships, secrets...",
  },
  {
    key: "locations",
    label: "Locations",
    icon: MapPin,
    placeholder: "Places, geography, cultures, rooms, landmarks, routes...",
  },
  {
    key: "worldRules",
    label: "World Rules",
    icon: ShieldCheck,
    placeholder: "Magic, technology, politics, economy, laws, limits...",
  },
  {
    key: "timeline",
    label: "Timeline",
    icon: Clock3,
    placeholder: "Major events, chapter chronology, ages, deadlines...",
  },
  {
    key: "styleGuide",
    label: "Style Guide",
    icon: ScrollText,
    placeholder: "POV, tense, tone, prose rules, banned words, formatting...",
  },
  {
    key: "canonFacts",
    label: "Canon Facts",
    icon: BookMarked,
    placeholder: "Facts the AI must never contradict...",
  },
  {
    key: "unresolvedThreads",
    label: "Unresolved Threads",
    icon: Network,
    placeholder: "Promises, mysteries, foreshadowing, arcs to resolve...",
  },
  {
    key: "notes",
    label: "Notes",
    icon: FileText,
    placeholder: "Anything else the book must remember...",
  },
];

const VISUAL_REFERENCE_GROUPS = [
  {
    key: "characters",
    title: "Characters",
    addLabel: "Add Character",
    namePlaceholder: "Mira Liao",
    descriptionPlaceholder:
      "Appearance, outfit, age, expression, role, must-keep details...",
    empty: "Add recurring people, creatures, or cast references.",
  },
  {
    key: "styleReferences",
    title: "Style",
    addLabel: "Add Style",
    namePlaceholder: "Painterly cinematic",
    descriptionPlaceholder: "Mood, palette, line style, lighting, camera feel...",
    empty: "Add art direction, mood, color, or cover style references.",
  },
  {
    key: "worldReferences",
    title: "World & Places",
    addLabel: "Add Place",
    namePlaceholder: "Krylon Belt",
    descriptionPlaceholder:
      "Locations, ships, rooms, architecture, props, recurring objects...",
    empty: "Add recurring settings, ships, objects, maps, or world look.",
  },
];

function countFilledFields(bible = {}) {
  return BIBLE_FIELDS.filter((field) => String(bible[field.key] || "").trim())
    .length;
}

function normalizeBibleMarkdown(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/,\s*(-\s+\*\*)/g, "\n$1")
    .replace(/,\s*(-\s+)/g, "\n$1")
    .trim();
}

const markdownComponents = {
  a({ href = "", children }) {
    const isExternal = /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  img({ src = "", alt = "" }) {
    return <img src={resolveImageUrl(src)} alt={alt} loading="lazy" />;
  },
};

function formatFileSize(size = 0) {
  const bytes = Math.max(0, Number(size || 0));

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SourceFilesPanel({
  sourceFiles = [],
  canManageSourceFiles = false,
  isUploadingSourceFiles = false,
  isGeneratingSourceBible = false,
  onAddSourceFiles,
  onRemoveSourceFile,
  onGenerateBibleFromSource,
}) {
  const files = Array.isArray(sourceFiles) ? sourceFiles : [];
  const remainingSlots = Math.max(0, SOURCE_FILE_LIMIT - files.length);
  const canAddMore = canManageSourceFiles && remainingSlots > 0;

  const handleFileSelection = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    onAddSourceFiles?.(selectedFiles.slice(0, remainingSlots));
    event.target.value = "";
  };

  return (
    <section className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">Source documents</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Upload up to {SOURCE_FILE_LIMIT} reference documents. Gemini uses them
            to build and refresh the Book Bible.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {files.length} / {SOURCE_FILE_LIMIT}
          </span>

          {canManageSourceFiles && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={Sparkles}
              isLoading={isGeneratingSourceBible}
              disabled={!files.length || isUploadingSourceFiles}
              onClick={onGenerateBibleFromSource}
            >
              Generate Bible
            </Button>
          )}
        </div>
      </div>

      {canManageSourceFiles && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 ${
              !canAddMore || isUploadingSourceFiles || isGeneratingSourceBible
                ? "pointer-events-none opacity-60"
                : ""
            }`}
          >
            <Upload className="size-3.5" />
            {isUploadingSourceFiles ? "Uploading..." : "Add documents"}
            <input
              type="file"
              multiple
              accept={SOURCE_FILE_ACCEPT}
              className="sr-only"
              disabled={!canAddMore || isUploadingSourceFiles || isGeneratingSourceBible}
              onChange={handleFileSelection}
            />
          </label>

          {canAddMore ? (
            <p className="text-xs text-slate-500">
              PDF, DOCX, Markdown, text, HTML, CSV, RTF, or JSON up to 12 MB each.
            </p>
          ) : files.length >= SOURCE_FILE_LIMIT ? (
            <p className="text-xs text-slate-500">
              Maximum of {SOURCE_FILE_LIMIT} source documents reached.
            </p>
          ) : null}
        </div>
      )}

      {files.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {files.map((file, index) => (
            <article
              key={file.id || file.url || index}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="size-9 shrink-0 rounded-lg bg-white text-violet-600 shadow-sm flex items-center justify-center">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={resolveImageUrl(file.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-semibold text-slate-900 hover:text-violet-700"
                  >
                    {file.name || `Source ${index + 1}`}
                  </a>
                  <p className="mt-1 text-xs text-slate-500">
                    {file.mimeType || "document"} · {formatFileSize(file.size)}
                  </p>
                </div>

                {canManageSourceFiles && (
                  <button
                    type="button"
                    onClick={() => onRemoveSourceFile?.(file.id || file.url)}
                    disabled={isUploadingSourceFiles || isGeneratingSourceBible}
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remove ${file.name || `source ${index + 1}`}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              {file.textPreview && (
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">
                  {file.textPreview}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          {canManageSourceFiles
            ? "No source documents yet. Add files, then generate the Book Bible."
            : "No source files saved for this book yet."}
        </div>
      )}

      {canManageSourceFiles && files.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Generate Bible uses credits based on document size and model usage.
        </p>
      )}
    </section>
  );
}

function BibleFieldEditor({ field, value, onChange }) {
  const [isPreview, setIsPreview] = useState(() =>
    Boolean(String(value || "").trim())
  );
  const Icon = field.icon;
  const renderedValue = normalizeBibleMarkdown(value);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon className="size-4 text-violet-600" />
          {field.label}
        </div>

        <div className="flex w-fit rounded-lg bg-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            aria-pressed={!isPreview}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !isPreview
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Pencil className="size-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            aria-pressed={isPreview}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              isPreview
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Eye className="size-3" />
            Preview
          </button>
        </div>
      </header>

      {isPreview ? (
        <div className="min-h-44 max-h-80 overflow-auto px-4 py-4">
          {renderedValue ? (
            <MDEditor.Markdown
              source={renderedValue}
              rehypePlugins={[[rehypeSanitize]]}
              components={markdownComponents}
              wrapperElement={{ "data-color-mode": "light" }}
              className="reading-content"
              style={{
                backgroundColor: "transparent",
                color: "#334155",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className="flex min-h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 hover:border-violet-200 hover:text-violet-600"
            >
              <Eye className="mb-2 size-5 opacity-50" />
              Add canon notes for {field.label.toLowerCase()}.
            </button>
          )}
        </div>
      ) : (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          rows={8}
          maxLength={12000}
          placeholder={field.placeholder}
          className="min-h-52 w-full resize-y border-0 bg-white px-4 py-4 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-violet-500/25"
        />
      )}
    </section>
  );
}

function VisualReferenceCard({
  group,
  reference,
  index,
  onEditVisualReference,
  onRemoveVisualReference,
  onUploadVisualReference,
  onImportVisualReferenceUrl,
}) {
  const [urlInput, setUrlInput] = useState("");
  const imageUrl = resolveImageUrl(reference.imageUrl);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 p-3 sm:grid-cols-[6.5rem,1fr]">
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={reference.name || reference.label || "Visual reference"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="size-7 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex gap-2">
            <input
              value={reference.name || reference.label || ""}
              onChange={(event) =>
                onEditVisualReference(
                  group.key,
                  index,
                  "name",
                  event.target.value
                )
              }
              placeholder={group.namePlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={() => onRemoveVisualReference(group.key, index)}
              className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${group.title.toLowerCase()} reference`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <textarea
            value={reference.description || ""}
            onChange={(event) =>
              onEditVisualReference(
                group.key,
                index,
                "description",
                event.target.value
              )
            }
            rows={3}
            maxLength={1200}
            placeholder={group.descriptionPlaceholder}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
          />

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
              <Upload className="size-3.5" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  onUploadVisualReference(group.key, index, file);
                }}
              />
            </label>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="Paste image URL"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => {
                  onImportVisualReferenceUrl(group.key, index, urlInput);
                  setUrlInput("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
              >
                <Link2 className="size-3.5" />
                Store
              </button>
            </div>
          </div>

          {reference.imageUrl && (
            <p className="truncate text-[11px] text-slate-400">
              Stored: {reference.imageUrl}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function VisualBiblePanel({
  visualBible = {},
  onEditVisualBibleMeta,
  onAddVisualReference,
  onEditVisualReference,
  onRemoveVisualReference,
  onUploadVisualReference,
  onImportVisualReferenceUrl,
}) {
  const enabled = visualBible.enabled !== false;
  const matchBookStyle = visualBible.matchBookStyle !== false;
  const referenceCount = VISUAL_REFERENCE_GROUPS.reduce(
    (count, group) =>
      count + (Array.isArray(visualBible[group.key]) ? visualBible[group.key].length : 0),
    0
  );

  return (
    <section className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">
            Visual Source of Truth
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-950">
            Visual Bible
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
            Supplied character, style, and world images are sent as image inputs
            for cover and chapter image generation. Chapter images also use
            previous generated art for book-wide style continuity.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                onEditVisualBibleMeta("enabled", event.target.checked)
              }
              className="size-4 accent-violet-600"
            />
            Use references
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={matchBookStyle}
              onChange={(event) =>
                onEditVisualBibleMeta("matchBookStyle", event.target.checked)
              }
              className="size-4 accent-violet-600"
            />
            Match prior art
          </label>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {VISUAL_REFERENCE_GROUPS.map((group) => {
          const references = Array.isArray(visualBible[group.key])
            ? visualBible[group.key]
            : [];

          return (
            <div
              key={group.key}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {group.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {references.length} saved
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => onAddVisualReference(group.key)}
                >
                  {group.addLabel}
                </Button>
              </div>

              <div className="space-y-3">
                {references.length ? (
                  references.map((reference, index) => (
                    <VisualReferenceCard
                      key={reference.id || `${group.key}-${index}`}
                      group={group}
                      reference={reference}
                      index={index}
                      onEditVisualReference={onEditVisualReference}
                      onRemoveVisualReference={onRemoveVisualReference}
                      onUploadVisualReference={onUploadVisualReference}
                      onImportVisualReferenceUrl={onImportVisualReferenceUrl}
                    />
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddVisualReference(group.key)}
                    className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400 transition hover:border-violet-300 hover:text-violet-700"
                  >
                    <ImageIcon className="mb-2 size-5 opacity-60" />
                    {group.empty}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <textarea
        value={visualBible.notes || ""}
        onChange={(event) => onEditVisualBibleMeta("notes", event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Visual rules: keep uniforms consistent, no neon palette, make dragons ancient and scarred..."
        className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
      />

      <p className="mt-2 text-xs text-slate-500">
        {referenceCount
          ? `${referenceCount} visual references available for AI image generation.`
          : "No visual references yet. Add them here after generation or before making new images."}
      </p>
    </section>
  );
}

function BookBibleTab({
  book,
  onEditBible,
  onEditVisualBibleMeta,
  onAddVisualReference,
  onEditVisualReference,
  onRemoveVisualReference,
  onUploadVisualReference,
  onImportVisualReferenceUrl,
  onAddSourceFiles,
  onRemoveSourceFile,
  onGenerateBibleFromSource,
  isUploadingSourceFiles = false,
  isGeneratingSourceBible = false,
  onRunBibleTool,
  runningBibleTool = "",
  pendingBibleReview = null,
  onApplyBibleReview,
  onDiscardBibleReview,
  continuityReport = "",
  onClearContinuityReport,
  onDownloadContinuityReport,
  isDownloadingContinuityReport = false,
}) {
  const bible = book.bible || {};
  const filledFields = countFilledFields(bible);
  const canManageSourceFiles = book.generation?.provider === "gemini";

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-violet-950 px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                  Source of Truth
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  Book Bible
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-200">
                  Canon memory for characters, world rules, timeline, tone, and
                  promises. Chapter generation uses this as truth.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Sparkles}
                  isLoading={runningBibleTool === "bible_extract"}
                  onClick={() => onRunBibleTool("bible_extract")}
                  className="bg-white/10 text-white hover:bg-white/20 focus:ring-white/40"
                >
                  Extract
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={BookMarked}
                  isLoading={runningBibleTool === "bible_update"}
                  onClick={() => onRunBibleTool("bible_update")}
                  className="bg-white/10 text-white hover:bg-white/20 focus:ring-white/40"
                >
                  Update
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={AlertTriangle}
                  isLoading={runningBibleTool === "continuity_check"}
                  onClick={() => onRunBibleTool("continuity_check")}
                  className="col-span-2 bg-white text-slate-950 hover:bg-slate-100 sm:col-span-1"
                >
                  Check Continuity
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Filled Sections
              </p>
              <p className="mt-1 text-lg font-bold text-slate-950">
                {filledFields} / {BIBLE_FIELDS.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                AI Generation
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                Included in chapter prompts
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {bible.updatedAt
                  ? new Date(bible.updatedAt).toLocaleString()
                  : "Not recorded"}
              </p>
            </div>
          </div>

          <SourceFilesPanel
            sourceFiles={book.sourceFiles || []}
            canManageSourceFiles={canManageSourceFiles}
            isUploadingSourceFiles={isUploadingSourceFiles}
            isGeneratingSourceBible={isGeneratingSourceBible}
            onAddSourceFiles={onAddSourceFiles}
            onRemoveSourceFile={onRemoveSourceFile}
            onGenerateBibleFromSource={onGenerateBibleFromSource}
          />

          <VisualBiblePanel
            visualBible={book.visualBible || {}}
            onEditVisualBibleMeta={onEditVisualBibleMeta}
            onAddVisualReference={onAddVisualReference}
            onEditVisualReference={onEditVisualReference}
            onRemoveVisualReference={onRemoveVisualReference}
            onUploadVisualReference={onUploadVisualReference}
            onImportVisualReferenceUrl={onImportVisualReferenceUrl}
          />

          {pendingBibleReview && (
            <section className="border-b border-violet-200 bg-violet-50 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-violet-950">
                    AI Bible update ready
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-violet-700">
                    Review the generated source of truth before applying it to
                    this book.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    icon={Check}
                    onClick={onApplyBibleReview}
                  >
                    Apply Bible
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={X}
                    onClick={onDiscardBibleReview}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </section>
          )}

          {continuityReport && (
            <section className="border-b border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-950">
                      Continuity Report
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Markdown-rendered review against the current Book Bible.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Download}
                      isLoading={isDownloadingContinuityReport}
                      disabled={!continuityReport}
                      onClick={onDownloadContinuityReport}
                      className="border border-amber-200 bg-white text-amber-950 hover:bg-amber-100"
                    >
                      Download PDF
                    </Button>
                    <button
                      type="button"
                      onClick={onClearContinuityReport}
                      className="rounded-lg p-2 text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      aria-label="Clear continuity report"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[34rem] overflow-auto rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                  <div>
                    <MDEditor.Markdown
                      source={continuityReport}
                      rehypePlugins={[[rehypeSanitize]]}
                      components={markdownComponents}
                      wrapperElement={{ "data-color-mode": "light" }}
                      className="reading-content"
                      style={{
                        backgroundColor: "transparent",
                        color: "#334155",
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-2">
            {BIBLE_FIELDS.map((field) => (
              <BibleFieldEditor
                key={field.key}
                field={field}
                value={bible[field.key] || ""}
                onChange={(value) => onEditBible(field.key, value)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default BookBibleTab;
