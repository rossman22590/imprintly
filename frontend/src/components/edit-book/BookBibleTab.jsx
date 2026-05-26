import {
  AlertTriangle,
  BookMarked,
  Check,
  Clock3,
  Download,
  FileText,
  MapPin,
  Network,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import Button from "../ui/Button";
import { resolveImageUrl } from "../../utils/api-endpoints";

const BIBLE_FIELDS = [
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

function countFilledFields(bible = {}) {
  return BIBLE_FIELDS.filter((field) => String(bible[field.key] || "").trim())
    .length;
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

function BookBibleTab({
  book,
  onEditBible,
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
            {BIBLE_FIELDS.map((field) => {
              const Icon = field.icon;

              return (
                <label key={field.key} className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Icon className="size-4 text-violet-600" />
                    {field.label}
                  </span>
                  <textarea
                    value={bible[field.key] || ""}
                    onChange={(event) =>
                      onEditBible(field.key, event.target.value)
                    }
                    rows={6}
                    maxLength={12000}
                    placeholder={field.placeholder}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default BookBibleTab;
