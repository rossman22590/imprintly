import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Pencil,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import { normalizeBook } from "../utils/api-shapes";

const TRIM_SIZES = [
  { id: "5x8", label: '5" × 8"', width: 5, height: 8 },
  { id: "5.25x8", label: '5.25" × 8"', width: 5.25, height: 8 },
  { id: "5.5x8.5", label: '5.5" × 8.5"', width: 5.5, height: 8.5 },
  { id: "6x9", label: '6" × 9"', width: 6, height: 9 },
  { id: "7x10", label: '7" × 10"', width: 7, height: 10 },
  { id: "8.5x11", label: '8.5" × 11"', width: 8.5, height: 11 },
];

const PAPER_TYPES = [
  { id: "bw-white", label: "B&W white paper", spinePerPage: 0.002252 },
  { id: "bw-cream", label: "B&W cream paper", spinePerPage: 0.0025 },
  { id: "color", label: "Color interior", spinePerPage: 0.002347 },
];

const TABS = [
  { id: "interior", label: "Interior PDF", icon: BookOpen },
  { id: "cover", label: "Cover Builder", icon: ImageIcon },
  { id: "metadata", label: "Listing Copy", icon: FileText },
  { id: "preflight", label: "Preflight", icon: ClipboardCheck },
];

const TOC_DESIGNS = [
  { id: "basic", label: "Standard" },
  { id: "editorial", label: "Editorial" },
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "luxe", label: "Luxe" },
  { id: "ledger", label: "Ledger" },
];

const META_FIELDS = [
  {
    id: "description",
    label: "Amazon Description",
    action: "kdp_description",
    buttonLabel: "Generate",
    hint: "Up to 4,000 characters. HTML supported on KDP.",
    rows: 10,
  },
  {
    id: "keywords",
    label: "7 Keyword Slots",
    action: "kdp_keywords",
    buttonLabel: "Generate",
    hint: "One phrase per line. Max 7 entries, max 50 chars each.",
    rows: 7,
  },
  {
    id: "categories",
    label: "Categories",
    action: "kdp_categories",
    buttonLabel: "Suggest",
    hint: "KDP allows up to 10 categories via Author Central.",
    rows: 6,
  },
  {
    id: "backCoverBlurb",
    label: "Back-Cover Blurb",
    action: "kdp_blurb",
    buttonLabel: "Generate",
    hint: "Keep under 150 words for standard paperback layouts.",
    rows: 8,
  },
  {
    id: "authorBio",
    label: "Author Bio",
    action: "kdp_author_bio",
    buttonLabel: "Write Bio",
    hint: "Used on the back cover and Amazon author page.",
    rows: 6,
  },
  {
    id: "copyrightPage",
    label: "Copyright Page",
    action: "kdp_copyright",
    buttonLabel: "Draft",
    hint: "Front matter page included in the interior PDF.",
    rows: 6,
  },
];

const DEFAULT_SETTINGS = {
  format: "paperback",
  trimSize: "6x9",
  paperType: "bw-white",
  pageCountOverride: "",
  coverImageSize: "2K",
  tocDesign: "basic",
};

const DEFAULT_METADATA = {
  tableOfContents: "",
  description: "",
  keywords: "",
  categories: "",
  backCoverBlurb: "",
  authorBio: "",
  copyrightPage: "",
  coverPrompt: "",
  riskNotes: "",
};

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripMarkdown(value = "") {
  return String(value || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFileName(value = "book") {
  return String(value || "book").replace(/[^a-zA-Z0-9-_]+/g, "_");
}

function buildBookContext(book, metadata, settings) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const chapterSummaries = chapters
    .slice(0, 16)
    .map((chapter, index) => {
      const excerpt = stripMarkdown(chapter.content || "").slice(0, 520);
      return `Chapter ${index + 1}: ${chapter.title || "Untitled"}\n${excerpt}`;
    })
    .join("\n\n");

  return `Book title: ${book?.title || "Untitled"}
Subtitle: ${book?.subtitle || ""}
Author: ${book?.author || ""}
Genre: ${book?.genre || ""}
Audience: ${book?.audience || ""}
KDP format: ${settings.format}
Trim size: ${settings.trimSize}
Paper type: ${settings.paperType}

Current KDP assets:
Table of contents: ${metadata.tableOfContents}
Description: ${metadata.description}
Keywords: ${metadata.keywords}
Categories: ${metadata.categories}
Back cover blurb: ${metadata.backCoverBlurb}
Author bio: ${metadata.authorBio}

Book content:
${chapterSummaries}`;
}

function downloadBlob(data, filename, type) {
  const url = window.URL.createObjectURL(new Blob([data], { type }));
  const linkEl = document.createElement("a");
  linkEl.href = url;
  linkEl.setAttribute("download", filename);
  document.body.appendChild(linkEl);
  linkEl.click();
  linkEl.parentNode.removeChild(linkEl);
  window.URL.revokeObjectURL(url);
}

function readCachedKdp(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function hasKdpValues(payload = {}) {
  return Object.values(payload || {}).some((value) => String(value || "").trim());
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StudioLabel({ children }) {
  return (
    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 mb-1.5">
      {children}
    </span>
  );
}

function StudioSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <StudioLabel>{label}</StudioLabel>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 pr-8 transition cursor-pointer shadow-sm"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
      </div>
    </label>
  );
}

function StudioTextarea({ label, value, onChange, action, rows = 8, hint }) {
  const [isPreview, setIsPreview] = useState(
    () => String(value || "").trim().length > 0
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const minH = Math.max(rows * 32, 220);

  return (
    <section>
      <header className="mb-2.5">
        <StudioLabel>{label}</StudioLabel>
        {hint && <p className="text-[11px] text-gray-500 -mt-0.5">{hint}</p>}
      </header>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="flex p-0.5 rounded-lg bg-gray-200 gap-px">
              <button
                type="button"
                onClick={() => setIsPreview(false)}
                aria-pressed={!isPreview}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  !isPreview
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Pencil className="size-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                aria-pressed={isPreview}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isPreview
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Eye className="size-3" />
                Preview
              </button>
            </div>
            <span className="text-xs text-gray-400 font-mono tabular-nums">
              {countWords(value)}w
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <GhostButton onClick={handleCopy} icon={Copy}>
              Copy
            </GhostButton>
            {action}
          </div>
        </div>

        {/* Content */}
        {isPreview ? (
          <div
            className="px-5 py-4 overflow-auto bg-white"
            style={{ minHeight: `${minH}px`, maxHeight: "36rem" }}
          >
            {String(value || "").trim() ? (
              <MDEditor.Markdown
                source={value || ""}
                rehypePlugins={[[rehypeSanitize]]}
                components={markdownComponents}
                wrapperElement={{ "data-color-mode": "light" }}
                style={{
                  backgroundColor: "transparent",
                  color: "#374151",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 14,
                  lineHeight: 1.8,
                }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-3 text-gray-400"
                style={{ minHeight: `${minH}px` }}
              >
                <Eye className="size-7 opacity-25" />
                <p className="text-sm text-center max-w-xs">
                  Nothing to preview yet —{" "}
                  <button
                    type="button"
                    onClick={() => setIsPreview(false)}
                    className="text-violet-600 hover:underline font-medium"
                  >
                    Edit
                  </button>{" "}
                  or use AI to generate.
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write here, or use AI to generate…"
            className="w-full border-0 px-5 py-4 text-sm text-gray-900 leading-6 resize-y outline-none placeholder-gray-400 bg-white"
            style={{ minHeight: `${minH}px` }}
          />
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, note, highlight = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-violet-200 bg-violet-50"
          : "border-gray-200 bg-white shadow-sm"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
          highlight ? "text-violet-600" : "text-gray-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-bold font-mono tracking-tight ${
          highlight ? "text-violet-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}

function AiButton({ children, onClick, loading, icon }) {
  const IconComponent = icon || Sparkles;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 transition hover:from-violet-700 hover:to-purple-700 hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <IconComponent className="size-3.5" />
      )}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, icon: Icon, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

function CheckRow({ check }) {
  const styles = {
    pass: {
      border: "border-l-emerald-500",
      icon: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    warn: {
      border: "border-l-amber-500",
      icon: "text-amber-600",
      bg: "bg-amber-50",
    },
    fail: {
      border: "border-l-rose-500",
      icon: "text-rose-600",
      bg: "bg-rose-50",
    },
  };
  const s = styles[check.status] || styles.warn;
  const Icon =
    check.status === "pass"
      ? CheckCircle2
      : check.status === "warn"
        ? TriangleAlert
        : XCircle;

  return (
    <div
      className={`rounded-xl border-l-2 border border-gray-200 ${s.border} ${s.bg} px-4 py-3.5`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`size-4 mt-0.5 shrink-0 ${s.icon}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{check.title}</p>
          <p className="mt-0.5 text-xs text-gray-600 leading-5">{check.detail}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function KDPStudioPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("interior");
  const [activeMetaField, setActiveMetaField] = useState("description");
  const [isMetaPreview, setIsMetaPreview] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [metadata, setMetadata] = useState(DEFAULT_METADATA);
  const [runningTool, setRunningTool] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isSavingKdp, setIsSavingKdp] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [manualSaveState, setManualSaveState] = useState("idle");
  const [hasHydratedKdp, setHasHydratedKdp] = useState(false);
  const lastPersistedPayloadRef = useRef("");
  const saveRequestIdRef = useRef(0);
  const manualSaveTimeoutRef = useRef(null);
  const storageKey = `bookify-kdp-studio:${bookId}`;

  useEffect(
    () => () => {
      if (manualSaveTimeoutRef.current) {
        window.clearTimeout(manualSaveTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasHydratedKdp) return;
    localStorage.setItem(storageKey, JSON.stringify({ settings, metadata }));
  }, [hasHydratedKdp, metadata, settings, storageKey]);

  useEffect(() => {
    const fetchBook = async () => {
      setIsLoading(true);
      setHasHydratedKdp(false);

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        const normalizedBook = normalizeBook(data?.book);
        const serverKdp = normalizedBook?.kdp || {};
        const cachedKdp = readCachedKdp(storageKey);
        const hasServerKdp =
          Boolean(serverKdp.updatedAt) || hasKdpValues(serverKdp.assets);
        const nextSettings = {
          ...DEFAULT_SETTINGS,
          ...((hasServerKdp ? serverKdp.settings : cachedKdp?.settings) || {}),
        };
        const nextMetadata = {
          ...DEFAULT_METADATA,
          ...((hasServerKdp ? serverKdp.assets : cachedKdp?.metadata) || {}),
        };

        setBook(normalizedBook);
        setSettings(nextSettings);
        setMetadata(nextMetadata);
        setLastSavedAt(serverKdp.updatedAt ? new Date(serverKdp.updatedAt) : null);
        setSaveError("");
        lastPersistedPayloadRef.current = hasServerKdp
          ? JSON.stringify({ settings: nextSettings, metadata: nextMetadata })
          : "";
        setHasHydratedKdp(true);
      } catch (error) {
        console.error("Error fetching KDP book:", error);
        toast.error("Failed to load KDP Studio.");
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [bookId, navigate, storageKey]);

  const chapters = useMemo(
    () => (Array.isArray(book?.chapters) ? book.chapters : []),
    [book?.chapters]
  );
  const wordCount = useMemo(
    () => chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    [chapters]
  );
  const estimatedPageCount = Math.max(24, Math.ceil(wordCount / 280) + 8);
  const pageCount =
    Number(settings.pageCountOverride) > 0
      ? Number(settings.pageCountOverride)
      : estimatedPageCount;
  const trim = TRIM_SIZES.find((item) => item.id === settings.trimSize) || TRIM_SIZES[3];
  const paper =
    PAPER_TYPES.find((item) => item.id === settings.paperType) || PAPER_TYPES[0];
  const spineWidth = pageCount * paper.spinePerPage;
  const coverWidth = trim.width * 2 + spineWidth + 0.25;
  const coverHeight = trim.height + 0.25;
  const spinePercent = Math.min(17, Math.max(3, (spineWidth / coverWidth) * 100));
  const coverImageUrl = book?.coverImage ? resolveImageUrl(book.coverImage) : "";

  const preflightChecks = useMemo(
    () => [
      {
        title: "Book identity",
        status: book?.title && book?.author ? "pass" : "fail",
        detail:
          book?.title && book?.author
            ? "Title and author are present."
            : "Add a title and author before upload.",
      },
      {
        title: "Cover image",
        status: book?.coverImage ? "pass" : "fail",
        detail: book?.coverImage
          ? "A front cover exists for exports and cover planning."
          : "Generate or upload a cover before KDP upload.",
      },
      {
        title: "Table of contents",
        status: metadata.tableOfContents.trim() ? "pass" : "warn",
        detail: metadata.tableOfContents.trim()
          ? "TOC draft is ready."
          : "Generate a table of contents for front matter review.",
      },
      {
        title: "Print spine",
        status: pageCount >= 80 ? "pass" : "warn",
        detail:
          pageCount >= 80
            ? "Spine text can be considered."
            : "KDP generally prints spine text only above 79 pages.",
      },
      {
        title: "Listing copy",
        status: metadata.description.trim() && metadata.keywords.trim() ? "pass" : "warn",
        detail: "Description and keyword slots should be ready before upload.",
      },
      {
        title: "Interior PDF",
        status: chapters.length && wordCount > 1000 ? "pass" : "warn",
        detail: `${chapters.length} chapters, ${wordCount.toLocaleString()} estimated words.`,
      },
      {
        title: "Wrap cover dimensions",
        status: "pass",
        detail: `${coverWidth.toFixed(3)}" × ${coverHeight.toFixed(3)}" at final page count.`,
      },
    ],
    [
      book?.author,
      book?.coverImage,
      book?.title,
      chapters.length,
      coverHeight,
      coverWidth,
      metadata.description,
      metadata.keywords,
      metadata.tableOfContents,
      pageCount,
      wordCount,
    ]
  );

  const readinessScore = Math.round(
    (preflightChecks.filter((c) => c.status === "pass").length /
      preflightChecks.length) *
      100
  );

  // SVG ring values
  const ringR = 38;
  const ringCircumference = 2 * Math.PI * ringR;
  const ringOffset = ringCircumference * (1 - readinessScore / 100);

  const updateSetting = (key, value) =>
    setSettings((current) => ({ ...current, [key]: value }));
  const updateMetadata = (key, value) =>
    setMetadata((current) => ({ ...current, [key]: value }));

  const handleMetaFieldChange = (fieldId) => {
    setActiveMetaField(fieldId);
    setIsMetaPreview(String(metadata[fieldId] || "").trim().length > 0);
  };

  const markManualSaveState = (state) => {
    if (manualSaveTimeoutRef.current) {
      window.clearTimeout(manualSaveTimeoutRef.current);
    }
    setManualSaveState(state);
    if (state === "saved" || state === "error") {
      manualSaveTimeoutRef.current = window.setTimeout(() => {
        setManualSaveState("idle");
      }, 1800);
    }
  };

  const persistKdp = useCallback(
    async (nextMetadata, nextSettings, options = {}) => {
      const payloadFingerprint = JSON.stringify({
        settings: nextSettings,
        metadata: nextMetadata,
      });

      if (payloadFingerprint === lastPersistedPayloadRef.current) {
        return true;
      }

      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;

      if (requestId === saveRequestIdRef.current) {
        setIsSavingKdp(true);
        setSaveError("");
      }

      try {
        const { data } = await axiosInstance.patch(
          `${API_ENDPOINTS.BOOKS.UPDATE_KDP}/${bookId}/kdp`,
          { settings: nextSettings, metadata: nextMetadata }
        );
        const updatedBook = normalizeBook(data?.book);

        if (updatedBook) setBook(updatedBook);

        if (requestId === saveRequestIdRef.current) {
          lastPersistedPayloadRef.current = payloadFingerprint;
          setLastSavedAt(new Date());
          setSaveError("");
        }

        if (options.showToast) toast.success("KDP assets saved to this book.");
        return true;
      } catch (error) {
        console.error("Error saving KDP Studio:", error);
        if (requestId === saveRequestIdRef.current) {
          setSaveError(error.response?.data?.error || "Save failed");
        }
        if (options.showToast) {
          toast.error(error.response?.data?.error || "KDP save failed.");
        }
        return false;
      } finally {
        if (requestId === saveRequestIdRef.current) setIsSavingKdp(false);
      }
    },
    [bookId]
  );

  useEffect(() => {
    if (!hasHydratedKdp || isLoading) return undefined;
    const timeoutId = window.setTimeout(() => persistKdp(metadata, settings), 900);
    return () => window.clearTimeout(timeoutId);
  }, [hasHydratedKdp, isLoading, metadata, persistKdp, settings]);

  const handleManualKdpSave = async () => {
    markManualSaveState("saving");
    const wasSaved = await persistKdp(metadata, settings, { showToast: true });
    markManualSaveState(wasSaved ? "saved" : "error");
  };

  const runPublishingTool = async (action, target) => {
    if (!book) return;
    setRunningTool(action);
    const loadingToast = toast.loading("Running publishing AI...");

    try {
      const {
        data: { content },
      } = await axiosInstance.post(API_ENDPOINTS.AI.QUALITY_TOOL, {
        action,
        content: buildBookContext(book, metadata, settings),
        provider: book.generation?.provider || "gemini",
        bookTitle: book.title,
        chapterTitle: "KDP Studio",
        audience: book.audience || "General readers",
      });

      const nextMetadata = { ...metadata, [target]: content || "" };
      updateMetadata(target, content || "");
      const wasSaved = await persistKdp(nextMetadata, settings);
      toast.dismiss(loadingToast);
      toast[wasSaved ? "success" : "error"](
        wasSaved ? "Generated and saved to this book." : "Generated, but save failed."
      );
    } catch (error) {
      console.error("Error running publishing AI:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Publishing AI failed.");
    } finally {
      setRunningTool("");
    }
  };

  const exportFile = async (kind) => {
    const extension = kind.toLowerCase();
    const endpoint = API_ENDPOINTS.EXPORTS[kind.toUpperCase()];
    const contentTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      epub: "application/epub+zip",
      markdown: "text/markdown",
    };
    const loadingToast = toast.loading(`Preparing ${extension.toUpperCase()}...`);

    try {
      const { data } = await axiosInstance.get(
        `${endpoint}/${bookId}/${extension}`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}.${extension === "markdown" ? "md" : extension}`,
        contentTypes[extension]
      );
      toast.dismiss(loadingToast);
      toast.success(`${extension.toUpperCase()} downloaded.`);
    } catch (error) {
      console.error(`Error exporting ${extension}:`, error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to export ${extension.toUpperCase()}.`);
    }
  };

  const exportTableOfContentsPdf = async () => {
    const wasSaved = await persistKdp(metadata, settings);
    if (!wasSaved) {
      toast.error("Save the table of contents before downloading.");
      return;
    }
    const loadingToast = toast.loading("Preparing TOC PDF...");
    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.PDF}/${bookId}/kdp-table-of-contents.pdf?design=${encodeURIComponent(settings.tocDesign)}`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}_table_of_contents.pdf`,
        "application/pdf"
      );
      toast.dismiss(loadingToast);
      toast.success("TOC PDF downloaded.");
    } catch (error) {
      console.error("Error exporting TOC PDF:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export TOC PDF.");
    }
  };

  const generateCover = async () => {
    if (!book) return;
    setIsGeneratingCover(true);
    const loadingToast = toast.loading("Generating KDP cover...");
    const prompt =
      metadata.coverPrompt.trim() ||
      `Create a professional KDP front cover for "${book.title}" by ${book.author}. Genre: ${book.genre || "book"}. Audience: ${book.audience || "general readers"}.`;

    try {
      const {
        data: { book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_COVER_IMAGE, {
        bookId,
        prompt,
        aspectRatio: "2:3",
        imageSize: settings.coverImageSize,
        model: "gemini-3.1-flash-image-preview",
        mode: "generate",
      });

      setBook(normalizeBook(nextBook));
      await persistKdp(metadata, settings);
      toast.dismiss(loadingToast);
      toast.success("Cover generated.");
    } catch (error) {
      console.error("Error generating KDP cover:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Cover generation failed.");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const downloadReport = async () => {
    const wasSaved = await persistKdp(metadata, settings);

    if (!wasSaved) {
      toast.error("Save risk notes before downloading the PDF.");
      return;
    }

    const loadingToast = toast.loading("Preparing risk notes PDF...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.PDF}/${bookId}/kdp-report.pdf`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}_risk_notes.pdf`,
        "application/pdf"
      );
      toast.dismiss(loadingToast);
      toast.success("Risk notes PDF downloaded.");
    } catch (error) {
      console.error("Error exporting risk notes PDF:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export risk notes PDF.");
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <DashboardLayout>
        <main className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-5 animate-pulse">
            <div className="h-36 rounded-2xl bg-gray-200" />
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
              <div className="space-y-4">
                <div className="h-48 rounded-2xl bg-gray-200" />
                <div className="h-64 rounded-2xl bg-gray-200" />
              </div>
              <div className="h-[36rem] rounded-2xl bg-gray-200" />
            </div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!book) return null;

  // ─── Save status label ─────────────────────────────────────────────────────
  const saveChip = isSavingKdp ? (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <Loader2 className="size-3 animate-spin" />
      Saving…
    </span>
  ) : saveError ? (
    <span className="flex items-center gap-1.5 text-xs text-rose-600">
      <TriangleAlert className="size-3" />
      {saveError}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
      {lastSavedAt
        ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready"}
    </span>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-5">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <header className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              {/* Left: back + title */}
              <div className="flex items-start gap-4 min-w-0">
                <Link
                  to={`/books/${bookId}/edit`}
                  aria-label="Back to editor"
                  className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                >
                  <ArrowLeft className="size-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">
                      <Sparkles className="size-3" />
                      KDP Studio
                    </span>
                    {saveChip}
                  </div>
                  <h1 className="mt-2 truncate text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                    {book.title}
                  </h1>
                  {book.author && (
                    <p className="mt-1 text-sm text-gray-500">by {book.author}</p>
                  )}
                </div>
              </div>

              {/* Right: action bar */}
              <div className="flex items-center gap-1 p-1 rounded-xl border border-gray-200 bg-gray-50 self-start xl:self-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleManualKdpSave}
                  disabled={manualSaveState === "saving" || isSavingKdp}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm disabled:opacity-50 transition"
                >
                  {manualSaveState === "saving" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : manualSaveState === "saved" ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {manualSaveState === "saving"
                      ? "Saving…"
                      : manualSaveState === "saved"
                        ? "Saved"
                        : manualSaveState === "error"
                          ? "Retry save"
                          : "Save"}
                  </span>
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <button
                  type="button"
                  onClick={() => exportFile("pdf")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm transition"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportFile("epub")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm transition"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">EPUB</span>
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <button
                  type="button"
                  onClick={downloadReport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition"
                >
                  <PackageCheck className="size-3.5" />
                  <span className="hidden sm:inline">Risk PDF</span>
                </button>
              </div>
            </div>
          </header>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="space-y-4">

              {/* Readiness ring */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 mb-4">
                  KDP Readiness
                </p>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <svg width="84" height="84" viewBox="0 0 100 100" aria-hidden="true">
                      <circle
                        cx="50"
                        cy="50"
                        r={ringR}
                        fill="none"
                        stroke="#ede9fe"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={ringR}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dashoffset 0.6s ease" }}
                      />
                      <text
                        x="50"
                        y="50"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#4c1d95"
                        fontSize="17"
                        fontWeight="700"
                        fontFamily="ui-monospace, monospace"
                      >
                        {readinessScore}%
                      </text>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {readinessScore === 100
                        ? "Upload ready"
                        : readinessScore >= 70
                          ? "Almost there"
                          : "Needs work"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 leading-5">
                      {preflightChecks.filter((c) => c.status === "pass").length} of{" "}
                      {preflightChecks.length} checks passing
                    </p>
                  </div>
                </div>
              </div>

              {/* Print settings */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">
                  Print Settings
                </p>

                <StudioSelect
                  label="Format"
                  value={settings.format}
                  onChange={(e) => updateSetting("format", e.target.value)}
                >
                  <option value="ebook">eBook</option>
                  <option value="paperback">Paperback</option>
                  <option value="hardcover">Hardcover</option>
                </StudioSelect>

                <StudioSelect
                  label="Trim size"
                  value={settings.trimSize}
                  onChange={(e) => updateSetting("trimSize", e.target.value)}
                >
                  {TRIM_SIZES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </StudioSelect>

                <StudioSelect
                  label="Paper & ink"
                  value={settings.paperType}
                  onChange={(e) => updateSetting("paperType", e.target.value)}
                >
                  {PAPER_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </StudioSelect>

                <label className="block">
                  <StudioLabel>Final page count</StudioLabel>
                  <input
                    type="number"
                    value={settings.pageCountOverride}
                    onChange={(e) => updateSetting("pageCountOverride", e.target.value)}
                    placeholder={`${estimatedPageCount} (estimated)`}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 transition shadow-sm"
                  />
                </label>
              </div>
            </aside>

            {/* ── Main panel ──────────────────────────────────────────────── */}
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

              {/* Tab bar */}
              <nav
                className="flex gap-1 p-2 border-b border-gray-200 overflow-x-auto bg-gray-50/50"
                aria-label="KDP Studio sections"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-pressed={isActive}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-500/25"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="size-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* Tab content */}
              <div className="p-5 md:p-6">

                {/* ── Interior PDF ──────────────────────────────────────── */}
                {activeTab === "interior" && (
                  <div className="space-y-6">

                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Metric
                        label="Words"
                        value={wordCount.toLocaleString()}
                        note={`${chapters.length} chapters`}
                      />
                      <Metric
                        label="Pages"
                        value={pageCount}
                        note={settings.pageCountOverride ? "Override" : "Estimated"}
                        highlight
                      />
                      <Metric
                        label="Spine"
                        value={`${spineWidth.toFixed(3)}"`}
                        note={paper.label}
                      />
                      <Metric
                        label="Wrap width"
                        value={`${coverWidth.toFixed(2)}"`}
                        note={`${coverHeight.toFixed(2)}" tall`}
                      />
                    </div>

                    {/* Download PDF */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          KDP Upload PDF
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Print-ready manuscript at your selected trim size.
                        </p>
                      </div>
                      <GhostButton onClick={() => exportFile("pdf")} icon={Download}>
                        Download PDF
                      </GhostButton>
                    </div>

                    {/* TOC */}
                    <StudioTextarea
                      label="Table of contents"
                      value={metadata.tableOfContents}
                      rows={10}
                      onChange={(value) => updateMetadata("tableOfContents", value)}
                      action={
                        <>
                          <GhostButton onClick={exportTableOfContentsPdf} icon={Download}>
                            Download PDF
                          </GhostButton>
                          <AiButton
                            onClick={() => runPublishingTool("kdp_toc", "tableOfContents")}
                            loading={runningTool === "kdp_toc"}
                          >
                            Generate TOC
                          </AiButton>
                        </>
                      }
                    />

                    {/* TOC design picker */}
                    <div>
                      <StudioLabel>TOC PDF design</StudioLabel>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-1">
                        {TOC_DESIGNS.map((design) => {
                          const isActive = settings.tocDesign === design.id;
                          return (
                            <button
                              key={design.id}
                              type="button"
                              onClick={() => updateSetting("tocDesign", design.id)}
                              className={`rounded-xl border p-3 text-left text-xs font-medium transition-all ${
                                isActive
                                  ? "border-violet-300 bg-violet-50 text-violet-700"
                                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
                              }`}
                            >
                              {/* Mini visual swatch */}
                              <div className="mb-2 space-y-1">
                                <div
                                  className={`h-px rounded-full ${isActive ? "bg-violet-500" : "bg-gray-300"}`}
                                />
                                <div
                                  className={`h-px rounded-full w-2/3 ${isActive ? "bg-violet-300" : "bg-gray-200"}`}
                                />
                                <div
                                  className={`h-px rounded-full w-1/2 ${isActive ? "bg-violet-200" : "bg-gray-100"}`}
                                />
                              </div>
                              {design.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Cover Builder ─────────────────────────────────────── */}
                {activeTab === "cover" && (
                  <div className="space-y-6">

                    {/* Cover mock-up */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Print wrap mock-up
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {coverWidth.toFixed(3)}" × {coverHeight.toFixed(3)}" at 300 DPI —{" "}
                            {Math.round(coverWidth * 300)} × {Math.round(coverHeight * 300)} px
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-900 p-4">
                        <div
                          className="grid overflow-hidden rounded-xl min-h-72"
                          style={{ gridTemplateColumns: `1fr ${spinePercent}% 1fr` }}
                        >
                          {/* Back cover */}
                          <div className="relative bg-gradient-to-br from-slate-900 to-[#0c0f18] p-5 border-r border-white/5">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-700 mb-4">
                              Back cover
                            </p>
                            <p className="text-xs text-slate-400 leading-5 line-clamp-8">
                              {metadata.backCoverBlurb ||
                                "Generate a back-cover blurb to preview this panel."}
                            </p>
                            <div className="absolute bottom-4 right-4 grid h-14 w-24 place-items-center rounded-lg border border-white/10 bg-white/5">
                              <p className="text-[9px] text-slate-600">Barcode</p>
                            </div>
                          </div>

                          {/* Spine */}
                          <div className="grid place-items-center bg-[#0c0f18] border-r border-white/5">
                            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                              {pageCount >= 80 ? book.title : "—"}
                            </span>
                          </div>

                          {/* Front cover */}
                          <div className="relative bg-slate-900 overflow-hidden">
                            {coverImageUrl ? (
                              <img
                                src={coverImageUrl}
                                alt={`${book.title} cover`}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700">
                                <ImageIcon className="size-6" />
                                <p className="text-[10px]">No cover</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cover generation controls */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px] gap-4">
                      <StudioTextarea
                        label="Cover image prompt"
                        value={metadata.coverPrompt}
                        rows={7}
                        onChange={(value) => updateMetadata("coverPrompt", value)}
                        action={
                          <AiButton
                            onClick={() =>
                              runPublishingTool("kdp_cover_prompt", "coverPrompt")
                            }
                            loading={runningTool === "kdp_cover_prompt"}
                          >
                            Generate prompt
                          </AiButton>
                        }
                      />

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 self-start">
                        <StudioSelect
                          label="Image size"
                          value={settings.coverImageSize}
                          onChange={(e) => updateSetting("coverImageSize", e.target.value)}
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </StudioSelect>

                        <button
                          type="button"
                          onClick={generateCover}
                          disabled={isGeneratingCover}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingCover ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <WandSparkles className="size-4" />
                          )}
                          {isGeneratingCover ? "Generating…" : "Generate Cover"}
                        </button>

                        <GhostButton
                          onClick={() => copyToClipboard(metadata.coverPrompt)}
                          icon={Copy}
                        >
                          Copy prompt
                        </GhostButton>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Listing Copy ──────────────────────────────────────── */}
                {activeTab === "metadata" && (
                  <div className="flex gap-5" style={{ minHeight: "520px" }}>

                    {/* Field navigator */}
                    <nav
                      className="w-48 shrink-0 space-y-0.5"
                      aria-label="Listing copy fields"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500 px-3 pb-2">
                        Fields
                      </p>
                      {META_FIELDS.map((field) => {
                        const value = metadata[field.id];
                        const wc = countWords(value);
                        const isFilled = String(value || "").trim().length > 0;
                        const isActive = activeMetaField === field.id;

                        return (
                          <button
                            key={field.id}
                            type="button"
                            onClick={() => handleMetaFieldChange(field.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                              isActive
                                ? "bg-violet-50 text-violet-700 border border-violet-200"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            }`}
                          >
                            <span className="truncate font-medium text-xs">
                              {field.label}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {wc > 0 && (
                                <span className="text-[9px] text-slate-600 font-mono">
                                  {wc}w
                                </span>
                              )}
                              <span
                                className={`size-1.5 rounded-full shrink-0 ${
                                  isFilled ? "bg-emerald-500" : "bg-slate-700"
                                }`}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </nav>

                    {/* Vertical divider */}
                    <div className="w-px bg-gray-200 shrink-0" />

                    {/* Active field editor */}
                    <div className="flex-1 min-w-0">
                      {META_FIELDS.filter((f) => f.id === activeMetaField).map((field) => (
                        <div key={field.id} className="space-y-3">
                          {/* Field title */}
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">
                              {field.label}
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-500">{field.hint}</p>
                          </div>

                          {/* Unified card */}
                          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50">
                              {/* Left: Edit/Preview toggle + word count */}
                              <div className="flex items-center gap-2.5">
                                <div className="flex p-0.5 rounded-lg bg-gray-200 gap-px">
                                  <button
                                    type="button"
                                    onClick={() => setIsMetaPreview(false)}
                                    aria-pressed={!isMetaPreview}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                      !isMetaPreview
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                                  >
                                    <Pencil className="size-3" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsMetaPreview(true)}
                                    aria-pressed={isMetaPreview}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                      isMetaPreview
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                                  >
                                    <Eye className="size-3" />
                                    Preview
                                  </button>
                                </div>
                                <span className="text-xs text-gray-400 font-mono tabular-nums">
                                  {countWords(metadata[field.id])}w
                                </span>
                              </div>

                              {/* Right: Copy + AI */}
                              <div className="flex items-center gap-2 shrink-0">
                                <GhostButton
                                  onClick={() => copyToClipboard(metadata[field.id])}
                                  icon={Copy}
                                >
                                  Copy
                                </GhostButton>
                                <AiButton
                                  onClick={() => runPublishingTool(field.action, field.id)}
                                  loading={runningTool === field.action}
                                >
                                  {field.buttonLabel}
                                </AiButton>
                              </div>
                            </div>

                            {/* Content */}
                            {isMetaPreview ? (
                              <div
                                className="px-5 py-4 overflow-auto bg-white"
                                style={{ minHeight: `${Math.max(field.rows * 52, 400)}px`, maxHeight: "44rem" }}
                              >
                                {String(metadata[field.id] || "").trim() ? (
                                  <MDEditor.Markdown
                                    source={metadata[field.id] || ""}
                                    rehypePlugins={[[rehypeSanitize]]}
                                    components={markdownComponents}
                                    wrapperElement={{ "data-color-mode": "light" }}
                                    style={{
                                      backgroundColor: "transparent",
                                      color: "#374151",
                                      fontFamily: "Georgia, 'Times New Roman', serif",
                                      fontSize: 14,
                                      lineHeight: 1.8,
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-10">
                                    <Eye className="size-7 opacity-25" />
                                    <p className="text-sm text-center max-w-xs">
                                      Nothing to preview yet — switch to{" "}
                                      <button
                                        type="button"
                                        onClick={() => setIsMetaPreview(false)}
                                        className="text-violet-600 hover:underline font-medium"
                                      >
                                        Edit
                                      </button>{" "}
                                      or use AI to generate.
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <textarea
                                rows={field.rows}
                                value={metadata[field.id]}
                                onChange={(e) => updateMetadata(field.id, e.target.value)}
                                placeholder={`Write your ${field.label.toLowerCase()} here, or use AI to generate…`}
                                className="w-full border-0 px-5 py-4 text-sm text-gray-900 leading-6 resize-y outline-none placeholder-gray-400 bg-white"
                                style={{ minHeight: `${Math.max(field.rows * 52, 400)}px` }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Preflight ─────────────────────────────────────────── */}
                {activeTab === "preflight" && (
                  <div className="space-y-6">

                    {/* Score + AI risk scan */}
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
                      {/* Score card */}
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col items-center text-center w-full md:w-52 shrink-0">
                        <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden="true">
                          <circle
                            cx="50"
                            cy="50"
                            r={ringR}
                            fill="none"
                            stroke="#ede9fe"
                            strokeWidth="7"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={ringR}
                            fill="none"
                            stroke={
                              readinessScore === 100
                                ? "#10b981"
                                : readinessScore >= 70
                                  ? "#7c3aed"
                                  : "#f43f5e"
                            }
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                            transform="rotate(-90 50 50)"
                            style={{ transition: "stroke-dashoffset 0.6s ease" }}
                          />
                          <text
                            x="50"
                            y="46"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#4c1d95"
                            fontSize="19"
                            fontWeight="700"
                            fontFamily="ui-monospace, monospace"
                          >
                            {readinessScore}%
                          </text>
                          <text
                            x="50"
                            y="62"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#9ca3af"
                            fontSize="9"
                            fontFamily="ui-sans-serif, sans-serif"
                          >
                            READY
                          </text>
                        </svg>
                        <p className="mt-3 text-sm font-semibold text-gray-900">
                          {readinessScore === 100
                            ? "Upload ready"
                            : readinessScore >= 70
                              ? "Almost there"
                              : "Needs work"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {preflightChecks.filter((c) => c.status === "pass").length}/
                          {preflightChecks.length} checks passing
                        </p>
                      </div>

                      {/* AI risk scan */}
                      <StudioTextarea
                        label="AI risk notes"
                        hint="KDP content policy review — missing pages, risky content, copyright flags."
                        value={metadata.riskNotes}
                        rows={7}
                        onChange={(value) => updateMetadata("riskNotes", value)}
                        action={
                          <AiButton
                            onClick={() =>
                              runPublishingTool("kdp_risk_check", "riskNotes")
                            }
                            loading={runningTool === "kdp_risk_check"}
                            icon={Sparkles}
                          >
                            Run AI scan
                          </AiButton>
                        }
                      />
                    </div>

                    {/* Checks grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {preflightChecks.map((check) => (
                        <CheckRow key={check.title} check={check} />
                      ))}
                    </div>

                    {/* Download risk notes */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Risk notes PDF</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Downloads only the AI risk scan results for this book.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadReport}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 hover:from-violet-700 hover:to-purple-700 transition shrink-0"
                      >
                        <PackageCheck className="size-4" />
                        Download Risk Notes
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </section>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default KDPStudioPage;
