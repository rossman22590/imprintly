import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_BASE_URL, API_ENDPOINTS } from "../utils/api-endpoints";
import { normalizeBook } from "../utils/api-shapes";
import { useAuthContext } from "../contexts/AuthContext";
import { getPublicShareUrl } from "../utils/public-share";
import {
  ChevronDown,
  BookMarked,
  Copy,
  Edit,
  ExternalLink,
  FileCode,
  FileArchive,
  FileDown,
  FileText,
  FileType,
  Headphones,
  Image,
  Languages,
  Library,
  Menu,
  NotebookText,
  Save,
  Share2,
  Sparkles,
  Store,
  Unlink,
  WandSparkles,
  X,
} from "lucide-react";
import {
  BookDetailsTab,
  BookBibleTab,
  Button,
  ChapterEditorTab,
  ChaptersSidebar,
  CreditBalancePill,
  Dropdown,
  DropdownItem,
  Input,
} from "../components";
import Modal from "../components/ui/Modal";
import { arrayMove } from "@dnd-kit/sortable";

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(content = "") {
  return content.split(/\s+/).filter((word) => word.length > 0).length;
}

function buildImageMarkdown({ image, prompt }) {
  const rawUrl = image?.url || "";
  const url = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `${API_BASE_URL || ""}${rawUrl}`;
  const alt = (image?.alt || `${prompt} illustration`)
    .replace(/[\r\n]+/g, " ")
    .replace(/\[|\]/g, "")
    .trim();

  return `![${alt}](${url})`;
}

async function copyToClipboard(value = "") {
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeOptionalHttpUrl(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return { url: "", error: "" };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        url: "",
        error: "Purchase link must start with http:// or https://",
      };
    }

    if (withProtocol.length > 500) {
      return {
        url: "",
        error: "Purchase link cannot exceed 500 characters.",
      };
    }

    return { url: parsed.toString(), error: "" };
  } catch {
    return { url: "", error: "Please enter a valid purchase link." };
  }
}

function replaceImageCommand(content = "", command, imageMarkdown = "") {
  if (!command) return content;

  const { commandText = "", start = 0, end = 0 } = command;

  if (content.slice(start, end) === commandText) {
    return `${content.slice(0, start)}${imageMarkdown}${content.slice(end)}`;
  }

  const commandLinePattern = new RegExp(
    `(^|\\n)${escapeRegExp(commandText)}(?=\\n|$)`
  );

  if (commandLinePattern.test(content)) {
    return content.replace(
      commandLinePattern,
      (_, prefix) => `${prefix}${imageMarkdown}`
    );
  }

  return content.trim()
    ? `${imageMarkdown}\n\n${content}`
    : `${imageMarkdown}\n`;
}

const AI_TOOL_LABELS = {
  rewrite: "Rewrite chapter",
  expand: "Expand chapter",
  shorten: "Shorten chapter",
  continue: "Continue writing",
  tone: "Adjust tone",
  consistency: "Consistency check",
  sources: "Source warnings",
  cover: "Cover prompt",
};

const AI_APPEND_HEADINGS = {
  consistency: "AI Consistency Notes",
  sources: "AI Source Warnings",
  cover: "AI Cover Prompt",
};

const DEFAULT_BOOK_BIBLE = {
  source: "",
  characters: "",
  locations: "",
  worldRules: "",
  timeline: "",
  styleGuide: "",
  canonFacts: "",
  unresolvedThreads: "",
  notes: "",
  updatedAt: null,
};

const BIBLE_JSON_KEYS = [
  "source",
  "characters",
  "locations",
  "worldRules",
  "timeline",
  "styleGuide",
  "canonFacts",
  "unresolvedThreads",
  "notes",
];

function hasBibleContent(bible = {}) {
  return BIBLE_JSON_KEYS.some((key) => String(bible?.[key] || "").trim());
}

function hasVisualBibleContent(visualBible = {}) {
  return ["characters", "styleReferences", "worldReferences"].some((key) =>
    (visualBible?.[key] || []).some(
      (reference) =>
        String(reference?.name || reference?.label || reference?.description || "").trim() ||
        String(reference?.imageUrl || "").trim()
    )
  ) || String(visualBible?.notes || "").trim();
}

function excerptMarkdown(content = "", maxLength = 1200) {
  return String(content || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cloneBookSnapshot(bookValue) {
  return JSON.parse(JSON.stringify(bookValue || {}));
}

function buildChapterGenerationContext({
  book,
  targetIndex,
  includeFutureOutline = true,
}) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const outline = chapters
    .map(
      (chapter, index) =>
        `${index + 1}. ${chapter.title || `Chapter ${index + 1}`}: ${
          chapter.description || ""
        }`
    )
    .join("\n");
  const priorChapters = chapters
    .slice(0, Math.max(targetIndex, 0))
    .filter((chapter) => String(chapter?.content || "").trim())
    .slice(-4)
    .map(
      (chapter, index) =>
        `Prior chapter ${index + 1}: ${chapter.title || "Untitled"}\n${
          chapter.generationStats?.editorialMemory ||
          excerptMarkdown(chapter.content, 1400)
        }`
    )
    .join("\n\n");
  const previousChapter = chapters
    .slice(0, Math.max(targetIndex, 0))
    .reverse()
    .find((chapter) => String(chapter?.content || "").trim());
  const nextOutline = includeFutureOutline
    ? chapters
        .slice(targetIndex + 1, targetIndex + 4)
        .map(
          (chapter, index) =>
            `Next planned chapter ${index + 1}: ${
              chapter.title || "Untitled"
            } - ${chapter.description || ""}`
        )
        .join("\n")
    : "";

  return [
    `Book title: ${book?.title || ""}`,
    `Genre: ${book?.genre || "Nonfiction"}`,
    `Audience: ${book?.audience || "General readers"}`,
    "Planned outline:",
    outline || "No outline provided.",
    priorChapters
      ? `\nPrior chapter continuity memory:\n${priorChapters}`
      : "",
    previousChapter
      ? `\nImmediate previous chapter ending:\n${excerptMarkdown(
          previousChapter.content,
          1800
        )}`
      : "",
    nextOutline ? `\nUpcoming outline context:\n${nextOutline}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function stringifyBibleToolValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = stringifyBibleToolValue(item).trim();

        if (!text) return "";
        return /^\s*[-*]\s+/.test(text) ? text : `- ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, itemValue]) => {
        const text = stringifyBibleToolValue(itemValue).trim();

        return text ? `- **${key}**: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(value || "");
}

function parseBibleToolContent(content = "") {
  const raw = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const trimmed =
    firstBrace >= 0 && lastBrace > firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : raw;

  try {
    const parsed = JSON.parse(trimmed);

    return BIBLE_JSON_KEYS.reduce((bible, key) => {
      bible[key] = stringifyBibleToolValue(parsed?.[key]);
      return bible;
    }, { ...DEFAULT_BOOK_BIBLE });
  } catch {
    return {
      ...DEFAULT_BOOK_BIBLE,
      notes: trimmed,
    };
  }
}

function buildBookManuscriptContext(book = {}) {
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapterText = chapters
    .map(
      (chapter, index) =>
        `# Chapter ${index + 1}: ${chapter.title || "Untitled"}\n${
          chapter.description ? `${chapter.description}\n\n` : ""
        }${chapter.content || ""}`
    )
    .join("\n\n---\n\n");

  return [
    `Book title: ${book.title || ""}`,
    `Genre: ${book.genre || "Nonfiction"}`,
    `Audience: ${book.audience || "General readers"}`,
    chapterText,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAiToolProposal({ action, originalContent, aiContent }) {
  const heading = AI_APPEND_HEADINGS[action];

  if (heading) {
    return `${originalContent.trimEnd()}\n\n## ${heading}\n\n${aiContent.trim()}`;
  }

  return aiContent;
}

function getWordDelta(before = "", after = "") {
  return countWords(after) - countWords(before);
}

function compactUnchangedRows(rows) {
  const compactRows = [];
  let unchangedRows = [];
  const contextLines = 2;

  const flushUnchangedRows = () => {
    if (unchangedRows.length === 0) return;

    if (unchangedRows.length <= contextLines * 2 + 1) {
      compactRows.push(...unchangedRows);
    } else {
      compactRows.push(...unchangedRows.slice(0, contextLines));
      compactRows.push({
        type: "meta",
        text: `${unchangedRows.length - contextLines * 2} unchanged lines`,
      });
      compactRows.push(...unchangedRows.slice(-contextLines));
    }

    unchangedRows = [];
  };

  rows.forEach((row) => {
    if (row.type === "same") {
      unchangedRows.push(row);
      return;
    }

    flushUnchangedRows();
    compactRows.push(row);
  });

  flushUnchangedRows();
  return compactRows;
}

function buildLineDiff(before = "", after = "") {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const maxCells = 160000;

  if (beforeLines.length * afterLines.length > maxCells) {
    return [
      {
        type: "meta",
        text: "Large chapter. Showing replacement blocks instead of a full line match.",
      },
      ...beforeLines.map((text, index) => ({
        type: "removed",
        oldLine: index + 1,
        text,
      })),
      ...afterLines.map((text, index) => ({
        type: "added",
        newLine: index + 1,
        text,
      })),
    ];
  }

  const matrix = Array.from({ length: beforeLines.length + 1 }, () =>
    Array(afterLines.length + 1).fill(0)
  );

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      matrix[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? matrix[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(
              matrix[beforeIndex + 1][afterIndex],
              matrix[beforeIndex][afterIndex + 1]
            );
    }
  }

  const rows = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
    if (
      beforeIndex < beforeLines.length &&
      afterIndex < afterLines.length &&
      beforeLines[beforeIndex] === afterLines[afterIndex]
    ) {
      rows.push({
        type: "same",
        oldLine: beforeIndex + 1,
        newLine: afterIndex + 1,
        text: beforeLines[beforeIndex],
      });
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    if (
      afterIndex < afterLines.length &&
      (beforeIndex === beforeLines.length ||
        matrix[beforeIndex][afterIndex + 1] >=
          matrix[beforeIndex + 1][afterIndex])
    ) {
      rows.push({
        type: "added",
        newLine: afterIndex + 1,
        text: afterLines[afterIndex],
      });
      afterIndex += 1;
      continue;
    }

    rows.push({
      type: "removed",
      oldLine: beforeIndex + 1,
      text: beforeLines[beforeIndex],
    });
    beforeIndex += 1;
  }

  return compactUnchangedRows(rows);
}

function EditBookPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] =
    useState(false);
  const [activeTab, setActiveTab] = useState("editor"); // "editor" | "bible" | "details"
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isPreviewShareSaving, setIsPreviewShareSaving] = useState(false);
  const [isCommunityListingSaving, setIsCommunityListingSaving] =
    useState(false);
  const [isCommunityListingOpen, setIsCommunityListingOpen] = useState(false);
  const [communityPurchaseUrl, setCommunityPurchaseUrl] = useState("");
  const [communityPurchaseUrlError, setCommunityPurchaseUrlError] =
    useState("");
  const [communityFreePdfEnabled, setCommunityFreePdfEnabled] =
    useState(false);
  const [isGeneratingChapterImage, setIsGeneratingChapterImage] =
    useState(false);
  const [activeEditorLockMessage, setActiveEditorLockMessage] = useState("");
  const [pendingAiToolReview, setPendingAiToolReview] = useState(null);
  const [pendingBibleReview, setPendingBibleReview] = useState(null);
  const [continuityReport, setContinuityReport] = useState("");
  const [isDownloadingContinuityReport, setIsDownloadingContinuityReport] =
    useState(false);
  const [runningBibleTool, setRunningBibleTool] = useState("");
  const [isUploadingSourceFiles, setIsUploadingSourceFiles] = useState(false);
  const [isGeneratingSourceBible, setIsGeneratingSourceBible] = useState(false);
  const [generationJob, setGenerationJob] = useState(null);
  const [newChapterOptions, setNewChapterOptions] = useState(null);
  const [regenerateOptions, setRegenerateOptions] = useState(null);
  const [pendingRegenerationReview, setPendingRegenerationReview] =
    useState(null);
  const skipNextAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const activeGenerationPollRef = useRef(null);
  const regenerationOriginalBookRef = useRef(null);
  const allowRegenerationNavigationRef = useRef(false);

  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const fileInputRef = useRef(null);
  const shouldBlockRegenerationNavigation = useCallback(
    ({ currentLocation, nextLocation }) =>
      Boolean(pendingRegenerationReview) &&
      !allowRegenerationNavigationRef.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash),
    [pendingRegenerationReview]
  );
  const regenerationNavigationBlocker = useBlocker(
    shouldBlockRegenerationNavigation
  );
  const blockedRegenerationLocation = regenerationNavigationBlocker.location;

  useEffect(() => {
    if (regenerationNavigationBlocker.state !== "blocked") return;

    const targetPath = [
      blockedRegenerationLocation?.pathname || "/dashboard",
      blockedRegenerationLocation?.search || "",
      blockedRegenerationLocation?.hash || "",
    ].join("");

    setPendingRegenerationReview((review) =>
      review ? { ...review, targetPath } : review
    );
  }, [
    regenerationNavigationBlocker.state,
    blockedRegenerationLocation?.pathname,
    blockedRegenerationLocation?.search,
    blockedRegenerationLocation?.hash,
  ]);

  // Fetch book on mount
  useEffect(() => {
    const fetchBook = async () => {
      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        const nextBook = normalizeBook(data?.book);

        if (!nextBook) {
          throw new Error("Book payload missing from API response.");
        }

        skipNextAutosaveRef.current = true;
        setBook(nextBook);
      } catch (error) {
        console.error("Error fetching book:", error);
        toast.error("Failed to fetch book details!", { duration: 5000 });
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [bookId, navigate]);

  const handleEditBook = (event) => {
    const { name, value } = event.target;
    setBook((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditBible = (field, value) => {
    setBook((prev) => ({
      ...prev,
      bible: {
        ...DEFAULT_BOOK_BIBLE,
        ...(prev.bible || {}),
        [field]: value,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const withVisualBible = (bookValue, updater) => {
    const current = {
      enabled: true,
      matchBookStyle: true,
      characters: [],
      styleReferences: [],
      worldReferences: [],
      notes: "",
      ...(bookValue.visualBible || {}),
    };

    return {
      ...bookValue,
      visualBible: {
        ...updater(current),
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const handleEditVisualBibleMeta = (field, value) => {
    setBook((prev) =>
      withVisualBible(prev, (visualBible) => ({
        ...visualBible,
        [field]: value,
      }))
    );
  };

  const handleAddVisualReference = (group) => {
    const defaultName =
      group === "characters"
        ? "New character"
        : group === "styleReferences"
          ? "Style reference"
          : "World reference";

    setBook((prev) =>
      withVisualBible(prev, (visualBible) => ({
        ...visualBible,
        [group]: [
          ...(Array.isArray(visualBible[group]) ? visualBible[group] : []),
          {
            id: `${group}-${Date.now()}`,
            name: defaultName,
            label: defaultName,
            description: "",
            imageUrl: "",
            kind:
              group === "characters"
                ? "character"
                : group === "styleReferences"
                  ? "style"
                  : "world",
          },
        ],
      }))
    );
  };

  const handleSetVisualReferenceImage = (group, referenceId, fallbackIndex, imageUrl) => {
    setBook((prev) =>
      withVisualBible(prev, (visualBible) => {
        const refs = Array.isArray(visualBible[group])
          ? [...visualBible[group]]
          : [];
        let refIndex = refs.findIndex(
          (reference) => reference?.id === referenceId
        );

        if (refIndex < 0 && refs[fallbackIndex]) {
          refIndex = fallbackIndex;
        }

        if (refIndex < 0) {
          const defaultName =
            group === "characters"
              ? "New character"
              : group === "styleReferences"
                ? "Style reference"
                : "World reference";

          refs.push({
            id: referenceId || `${group}-${Date.now()}`,
            name: defaultName,
            label: defaultName,
            description: "",
            imageUrl,
            kind:
              group === "characters"
                ? "character"
                : group === "styleReferences"
                  ? "style"
                  : "world",
          });
        } else {
          refs[refIndex] = {
            ...refs[refIndex],
            imageUrl,
          };
        }

        return {
          ...visualBible,
          [group]: refs,
        };
      })
    );
  };

  const handleEditVisualReference = (group, index, field, value) => {
    setBook((prev) =>
      withVisualBible(prev, (visualBible) => {
        const refs = Array.isArray(visualBible[group])
          ? [...visualBible[group]]
          : [];

        refs[index] = {
          ...(refs[index] || {}),
          [field]: value,
        };

        return {
          ...visualBible,
          [group]: refs,
        };
      })
    );
  };

  const handleRemoveVisualReference = (group, index) => {
    setBook((prev) =>
      withVisualBible(prev, (visualBible) => ({
        ...visualBible,
        [group]: (Array.isArray(visualBible[group])
          ? visualBible[group]
          : []
        ).filter((_, itemIndex) => itemIndex !== index),
      }))
    );
  };

  const handleUploadVisualReference = async (group, index, file) => {
    if (!file) return;

    const referenceId = book.visualBible?.[group]?.[index]?.id;
    const formData = new FormData();
    formData.append("referenceImage", file);

    try {
      const {
        data: { imageUrl },
      } = await axiosInstance.post(
        API_ENDPOINTS.BOOKS.UPLOAD_VISUAL_REFERENCE,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      handleSetVisualReferenceImage(group, referenceId, index, imageUrl);
      toast.success("Visual reference uploaded.");
    } catch (error) {
      console.error("Error uploading visual reference:", error);
      toast.error(
        error.response?.data?.error || "Failed to upload visual reference."
      );
    }
  };

  const SOURCE_FILE_LIMIT = 6;

  const handleAddSourceFiles = async (files = []) => {
    if (!files.length) return;

    if (book.generation?.provider !== "gemini") {
      toast.error("Source documents require the Gemini 3.5 Flash Book Engine.");
      return;
    }

    const currentFiles = Array.isArray(book.sourceFiles) ? book.sourceFiles : [];
    const remainingSlots = Math.max(0, SOURCE_FILE_LIMIT - currentFiles.length);
    const filesToUpload = files.slice(0, remainingSlots);

    if (!filesToUpload.length) {
      toast.error(`You can attach up to ${SOURCE_FILE_LIMIT} source documents.`);
      return;
    }

    const formData = new FormData();

    filesToUpload.forEach((file) => {
      formData.append("sourceFiles", file);
    });

    setIsUploadingSourceFiles(true);

    try {
      const {
        data: { sourceFiles: uploadedSourceFiles = [] },
      } = await axiosInstance.post(
        API_ENDPOINTS.BOOKS.UPLOAD_SOURCE_FILES,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const nextBook = {
        ...book,
        sourceFiles: [...currentFiles, ...uploadedSourceFiles].slice(
          0,
          SOURCE_FILE_LIMIT
        ),
      };

      skipNextAutosaveRef.current = true;
      setBook(nextBook);

      const saved = await handleSaveChanges(nextBook, false);

      if (saved) {
        toast.success(
          `${uploadedSourceFiles.length} source ${
            uploadedSourceFiles.length === 1 ? "document" : "documents"
          } added.`
        );
      }
    } catch (error) {
      console.error("Error uploading source files:", error);
      toast.error(error.response?.data?.error || "Failed to upload source files.");
    } finally {
      setIsUploadingSourceFiles(false);
    }
  };

  const handleRemoveSourceFile = async (fileId) => {
    const currentFiles = Array.isArray(book.sourceFiles) ? book.sourceFiles : [];
    const nextFiles = currentFiles.filter(
      (file) => file.id !== fileId && file.url !== fileId
    );

    if (nextFiles.length === currentFiles.length) return;

    const nextBook = {
      ...book,
      sourceFiles: nextFiles,
    };

    skipNextAutosaveRef.current = true;
    setBook(nextBook);

    const saved = await handleSaveChanges(nextBook, false);

    if (saved) {
      toast.success("Source document removed.");
    }
  };

  const handleGenerateBibleFromSource = async () => {
    if (book.generation?.provider !== "gemini") {
      toast.error("Source Bible generation requires the Gemini 3.5 Flash Book Engine.");
      return;
    }

    if (!Array.isArray(book.sourceFiles) || book.sourceFiles.length === 0) {
      toast.error("Add at least one source document first.");
      return;
    }

    setIsGeneratingSourceBible(true);
    const loadingToast = toast.loading("Generating Book Bible from source documents...");

    try {
      const {
        data: { bible, billing },
      } = await axiosInstance.post(
        API_ENDPOINTS.AI.GENERATE_BOOK_BIBLE_FROM_SOURCES,
        {
          bookId,
          sourceFiles: book.sourceFiles,
          useSourceFiles: true,
          provider: book.generation?.provider || "gemini",
        }
      );

      toast.dismiss(loadingToast);

      setPendingBibleReview({
        action: "bible_from_source",
        bible: {
          ...DEFAULT_BOOK_BIBLE,
          ...BIBLE_JSON_KEYS.reduce((nextBible, key) => {
            nextBible[key] = String(bible?.[key] || "");
            return nextBible;
          }, {}),
        },
      });
      setActiveTab("bible");

      const chargedCredits = billing?.charge?.credits;

      toast.success(
        chargedCredits
          ? `Book Bible ready to review. Charged ${chargedCredits} credits.`
          : "Book Bible ready to review."
      );
    } catch (error) {
      console.error("Error generating Book Bible from source documents:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error ||
          "Failed to generate Book Bible from source documents."
      );
    } finally {
      setIsGeneratingSourceBible(false);
    }
  };

  const handleImportVisualReferenceUrl = async (group, index, url) => {
    const sourceUrl = String(url || "").trim();
    const referenceId = book.visualBible?.[group]?.[index]?.id;

    if (!sourceUrl) {
      toast.error("Paste an image URL first.");
      return;
    }

    try {
      const {
        data: { imageUrl },
      } = await axiosInstance.post(
        API_ENDPOINTS.BOOKS.IMPORT_VISUAL_REFERENCE_URL,
        { url: sourceUrl }
      );

      handleSetVisualReferenceImage(group, referenceId, index, imageUrl);
      toast.success("Visual reference stored.");
    } catch (error) {
      console.error("Error importing visual reference URL:", error);
      toast.error(
        error.response?.data?.error || "Failed to import visual reference."
      );
    }
  };

  const getDefaultNewChapterOptions = (bookValue = book) => {
    const chapters = Array.isArray(bookValue?.chapters)
      ? bookValue.chapters
      : [];
    const previousChapter = chapters.at(-1);
    const nextTitle = `Chapter ${chapters.length + 1}`;
    const description = previousChapter?.title
      ? `Continue from "${previousChapter.title}" and carry its unresolved threads forward.`
      : "";

    return {
      title: nextTitle,
      description,
      startBlank: false,
      generateImage: false,
      imagePrompt: previousChapter?.title
        ? `Create a polished chapter illustration that continues visually from "${previousChapter.title}" while matching the book's established character, setting, and style.`
        : "Create a polished chapter illustration that introduces this chapter's main scene while matching the book's style.",
    };
  };

  const openNewChapterModal = () => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    setNewChapterOptions(getDefaultNewChapterOptions());
  };

  const createChapterFromOptions = (
    options = {},
    chapterNumber = book.chapters.length + 1
  ) => ({
    title: String(options.title || "").trim() || `Chapter ${chapterNumber}`,
    description: String(options.description || "").trim(),
    content: "",
  });

  const getNewChapterSnapshot = (options = {}) => {
    const chapters = Array.isArray(book.chapters) ? book.chapters : [];
    const chapterIndex = chapters.length;
    const newChapter = createChapterFromOptions(options, chapterIndex + 1);

    return {
      chapterIndex,
      newChapter,
      nextBook: {
        ...book,
        chapters: [...chapters, newChapter],
      },
    };
  };

  const handleStartBlankNewChapter = () => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    const chapters = Array.isArray(book.chapters) ? book.chapters : [];
    const chapterNumber = chapters.length + 1;
    const { chapterIndex, nextBook } = getNewChapterSnapshot({
      title: `Chapter ${chapterNumber}`,
      description: "",
    });

    setNewChapterOptions(null);
    setBook(nextBook);
    setSelectedChapterIndex(chapterIndex);
  };

  const handleEditChapter = (name, value) => {
    if (isGenerating || isGeneratingChapterImage) return;

    const updatedChapters = [...book.chapters];
    updatedChapters[selectedChapterIndex][name] = value;
    setBook((prev) => ({ ...prev, chapters: updatedChapters }));
  };

  const handleDeleteChapter = (index) => {
    if (book.chapters.length <= 1) {
      toast.error("A book must have at least one chapter!");
      return;
    }

    const updatedChapters = book.chapters.filter((_, i) => i !== index);
    setBook((prev) => ({ ...prev, chapters: updatedChapters }));
    setSelectedChapterIndex((prevIndex) =>
      prevIndex >= index ? Math.max(0, prevIndex - 1) : prevIndex
    );
  };

  const handleReorderChapters = (oldIndex, newIndex) => {
    setBook((prev) => ({
      ...prev,
      chapters: arrayMove(prev.chapters, oldIndex, newIndex),
    }));
    setSelectedChapterIndex(newIndex);
  };

  const saveBookSnapshot = useCallback(async (bookToSave, showToast = true) => {
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.BOOKS.UPDATE_CONTENT}/${bookId}`,
        bookToSave
      );
      const savedBook = normalizeBook(data?.book) || bookToSave;

      skipNextAutosaveRef.current = true;
      setBook(savedBook);

      if (showToast) {
        toast.success("Changes saved successfully!");
      }

      return savedBook;
    } catch (error) {
      console.error("Error saving chapter content:", error);
      toast.error("Failed to save changes! Please try again.", {
        duration: 5000,
      });

      return null;
    } finally {
      setIsSaving(false);
    }
  }, [bookId]);

  const handleSaveChanges = useCallback(async (bookToSave = book, showToast = true) => {
    const savedBook = await saveBookSnapshot(bookToSave, showToast);

    return Boolean(savedBook);
  }, [book, saveBookSnapshot]);

  const handleManualSave = async () => {
    const saved = await handleSaveChanges();

    if (saved && pendingRegenerationReview) {
      setPendingRegenerationReview(null);
      regenerationOriginalBookRef.current = null;
      allowRegenerationNavigationRef.current = false;
    }
  };

  const requestEditorNavigation = useCallback(
    (path) => {
      if (pendingRegenerationReview) {
        setPendingRegenerationReview((review) => ({
          ...review,
          targetPath: path,
        }));
        return;
      }

      navigate(path);
    },
    [navigate, pendingRegenerationReview]
  );

  const handleCloseRegenerationLeavePrompt = useCallback(() => {
    allowRegenerationNavigationRef.current = false;

    if (regenerationNavigationBlocker.state === "blocked") {
      regenerationNavigationBlocker.reset();
    }

    setPendingRegenerationReview((review) =>
      review ? { ...review, targetPath: "" } : review
    );
  }, [regenerationNavigationBlocker]);

  const continueAfterRegenerationDecision = useCallback(
    (targetPath) => {
      allowRegenerationNavigationRef.current = true;

      if (regenerationNavigationBlocker.state === "blocked") {
        regenerationNavigationBlocker.proceed();
        return;
      }

      navigate(targetPath);
    },
    [navigate, regenerationNavigationBlocker]
  );

  const handleSaveRegeneratedAndContinue = async () => {
    if (!pendingRegenerationReview) return;

    const targetPath = pendingRegenerationReview.targetPath || "/dashboard";
    const saved = await handleSaveChanges(book, false);

    if (!saved) {
      toast.error("Could not save the regenerated book yet.");
      return;
    }

    setPendingRegenerationReview(null);
    regenerationOriginalBookRef.current = null;
    continueAfterRegenerationDecision(targetPath);
  };

  const handleSaveRegeneratedDraft = async () => {
    if (!pendingRegenerationReview) return;

    const saved = await handleSaveChanges(book, false);

    if (!saved) {
      toast.error("Could not save the regenerated book yet.");
      return;
    }

    setPendingRegenerationReview(null);
    regenerationOriginalBookRef.current = null;
    allowRegenerationNavigationRef.current = false;
    toast.success("Regenerated book saved.");
  };

  const restorePreviousRegenerationDraft = async ({ continueTo = "" } = {}) => {
    if (!pendingRegenerationReview?.originalBook) return;

    setIsSaving(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.BOOKS.UPDATE_CONTENT}/${bookId}`,
        pendingRegenerationReview.originalBook
      );
      const restoredBook =
        normalizeBook(data?.book) || pendingRegenerationReview.originalBook;

      skipNextAutosaveRef.current = true;
      setBook(restoredBook);
      setPendingRegenerationReview(null);
      regenerationOriginalBookRef.current = null;
      allowRegenerationNavigationRef.current = false;
      toast.success("Previous book restored.");
      if (continueTo) {
        continueAfterRegenerationDecision(continueTo);
      }
    } catch (error) {
      console.error("Error restoring previous book:", error);
      toast.error(
        error.response?.data?.error || "Failed to restore the previous book."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardRegeneratedDraft = () =>
    restorePreviousRegenerationDraft();

  const handleDiscardRegeneratedAndContinue = () =>
    restorePreviousRegenerationDraft({
      continueTo: pendingRegenerationReview?.targetPath || "/dashboard",
    });

  const handleCoverImgUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      toast.error("Please select an image file first.");
      return;
    }

    const formData = new FormData();
    formData.append("coverImage", file);
    setIsUploading(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.BOOKS.UPDATE_COVER}/${bookId}/cover`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setBook(normalizeBook(data?.book));
      toast.success("Cover image updated successfully!");
    } catch (error) {
      console.error("Error uploading cover image:", error);
      toast.error("Failed to upload cover image! Please try again.", {
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const generateChapterContentForBook = async ({
    sourceBook = book,
    index,
    providerOverride = null,
    saveAfter = true,
    lockMessage = "",
  }) => {
    const chapter = sourceBook.chapters[index];

    if (!chapter || !chapter.title) {
      toast.error("Chapter title is required to generate content!");
      return null;
    }

    const provider = providerOverride || sourceBook.generation?.provider || "groq";
    const providerName = provider === "gemini" ? "Gemini" : "Groq";

    setActiveEditorLockMessage(
      lockMessage ||
        `${providerName} is generating "${chapter.title}". Editing is paused so the chapter cannot change underneath the result.`
    );
    setIsGenerating(true);
    const loadingToast = toast.loading(
      `Generating chapter with ${providerName}...`
    );

    try {
      const {
        data: { content, stats, chapterTitle: generatedChapterTitle },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_CHAPTER_CONTENT, {
        chapterTitle: chapter.title,
        chapterDescription: chapter.description || "",
        chapterIndex: index,
        style: sourceBook.generation?.style || "Informative",
        provider,
        model:
          provider === "groq" ? sourceBook.generation?.sectionModel : undefined,
        useGoogleSearch:
          provider === "gemini" &&
          Boolean(sourceBook.generation?.useGoogleSearch),
        includeTextGraphics: Boolean(sourceBook.generation?.includeTextGraphics),
        chapterLength: sourceBook.generation?.chapterLength || "medium",
        bookBible: sourceBook.bible,
        visualBible: sourceBook.visualBible,
        bookTitle: sourceBook.title,
        genre: sourceBook.genre || "Nonfiction",
        audience: sourceBook.audience || "General readers",
        bookContext: buildChapterGenerationContext({
          book: sourceBook,
          targetIndex: index,
        }),
      });

      const updatedChapterTitle =
        generatedChapterTitle?.trim() || chapter.title;
      const updatedChapters = [...sourceBook.chapters];
      updatedChapters[index] = {
        ...updatedChapters[index],
        ...(generatedChapterTitle ? { title: updatedChapterTitle } : {}),
        content,
        generationStatus: "complete",
        wordCount: countWords(content),
        generationStats: stats ? { ...stats, provider } : { provider },
      };
      const updatedBook = { ...sourceBook, chapters: updatedChapters };

      skipNextAutosaveRef.current = true;
      setBook(updatedBook);

      toast.dismiss(loadingToast);
      toast.success(
        `${providerName} content generated for "${updatedChapterTitle}"`,
        {
          duration: 3000,
        }
      );

      if (saveAfter) {
        return await saveBookSnapshot(updatedBook, false);
      }

      return updatedBook;
    } catch (error) {
      console.error("Error generating chapter content:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to generate chapter content.", { duration: 5000 });
      return null;
    } finally {
      setIsGenerating(false);
      setActiveEditorLockMessage("");
    }
  };

  const handleGenerateChapterContent = async (index, providerOverride = null) => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    await generateChapterContentForBook({
      sourceBook: book,
      index,
      providerOverride,
    });
  };

  const handleGenerateCoverImage = async ({
    prompt,
    aspectRatio,
    imageSize,
    model,
    mode,
  }) => {
    if (!book.title) {
      toast.error("Book title is required before generating a cover.");
      return;
    }

    setIsGeneratingCover(true);
    const loadingToast = toast.loading("Generating cover image...");

    try {
      const {
        data: { book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_COVER_IMAGE, {
        bookId,
        prompt,
        aspectRatio,
        imageSize,
        model,
        mode,
        visualBible: book.visualBible,
      });

      skipNextAutosaveRef.current = true;
      setBook(normalizeBook(nextBook));
      toast.dismiss(loadingToast);
      toast.success("Cover image generated.");
    } catch (error) {
      console.error("Error generating cover image:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error || "Failed to generate cover image."
      );
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const generateChapterImageForBook = async ({
    sourceBook = book,
    index,
    options = {},
    lockMessage = "",
  }) => {
    const chapter = sourceBook.chapters[index];

    if (!chapter) {
      toast.error("Select a chapter before generating an image.");
      return null;
    }

    setActiveEditorLockMessage(
      lockMessage ||
        `Generating an image for "${chapter.title || `Chapter ${index + 1}`}". Editing is paused until the image is inserted.`
    );
    setIsGeneratingChapterImage(true);
    const loadingToast = toast.loading("Generating chapter image...");

    try {
      const {
        data: { book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_CHAPTER_IMAGE, {
        bookId,
        chapterIndex: index,
        visualBible: sourceBook.visualBible,
        ...options,
      });
      const normalizedNextBook = normalizeBook(nextBook) || sourceBook;

      skipNextAutosaveRef.current = true;
      setBook(normalizedNextBook);
      toast.dismiss(loadingToast);
      toast.success("Chapter image inserted into markdown.");

      return normalizedNextBook;
    } catch (error) {
      console.error("Error generating chapter image:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error || "Failed to generate chapter image."
      );
      return null;
    } finally {
      setIsGeneratingChapterImage(false);
      setActiveEditorLockMessage("");
    }
  };

  const handleGenerateChapterImage = async (index, options = {}) => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    await generateChapterImageForBook({
      sourceBook: book,
      index,
      options,
    });
  };

  const handleCreateNewChapter = async (event) => {
    event.preventDefault();

    if (!newChapterOptions) return;

    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    const options = newChapterOptions;

    if (options.startBlank) {
      handleStartBlankNewChapter();
      return;
    }

    const shouldGenerateImage = Boolean(options.generateImage);
    const { chapterIndex, newChapter, nextBook } = getNewChapterSnapshot(options);

    setNewChapterOptions(null);
    setSelectedChapterIndex(chapterIndex);

    skipNextAutosaveRef.current = true;
    setBook(nextBook);

    const sourceBook = shouldGenerateImage
      ? await saveBookSnapshot(nextBook, false)
      : nextBook;

    if (!sourceBook) return;

    const generatedBook = await generateChapterContentForBook({
      sourceBook,
      index: chapterIndex,
      lockMessage: shouldGenerateImage
        ? `Generating text for "${newChapter.title}" before creating the chapter image.`
        : `Generating text for "${newChapter.title}". Editing is paused while the new chapter is written.`,
    });

    if (!generatedBook) {
      toast.error("New chapter was created, but text generation failed.");
      return;
    }

    if (!shouldGenerateImage) return;

    const imagePrompt =
      String(options.imagePrompt || "").trim() ||
      `Create a polished inline ebook illustration for "${newChapter.title}".`;

    await generateChapterImageForBook({
      sourceBook: generatedBook,
      index: chapterIndex,
      options: { prompt: imagePrompt },
      lockMessage: `Generating an image for "${newChapter.title}" after writing the chapter.`,
    });
  };

  const handleGenerateInlineImageCommand = async (index, command) => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    const chapter = book.chapters[index];
    const prompt = command?.prompt?.trim();

    if (!chapter || !prompt) {
      toast.error("Type /generate image of something first.");
      return;
    }

    setActiveEditorLockMessage(
      `Generating an image for "${chapter.title || `Chapter ${index + 1}`}". Editing is paused until the image is inserted.`
    );
    setIsGeneratingChapterImage(true);
    const loadingToast = toast.loading("Generating image for this spot...");

    try {
      const {
        data: { image, book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_CHAPTER_IMAGE, {
        bookId,
        chapterIndex: index,
        prompt,
        alt: `${prompt} illustration`,
        aspectRatio: command.aspectRatio || "16:9",
        imageSize: command.imageSize || "1K",
        model: command.model,
        visualBible: book.visualBible,
        insertIntoContent: false,
      });
      const normalizedNextBook = normalizeBook(nextBook) || book;
      const nextChapters = [...normalizedNextBook.chapters];
      const contentWithCommand =
        command.sourceContent || book.chapters[index]?.content || "";
      const imageMarkdown = buildImageMarkdown({ image, prompt });
      const updatedContent = replaceImageCommand(
        contentWithCommand,
        command,
        imageMarkdown
      );

      nextChapters[index] = {
        ...nextChapters[index],
        content: updatedContent,
        wordCount: countWords(updatedContent),
      };

      const updatedBook = {
        ...normalizedNextBook,
        chapters: nextChapters,
      };

      skipNextAutosaveRef.current = true;
      setBook(updatedBook);
      toast.dismiss(loadingToast);
      toast.success("Image inserted at the command.");

      await handleSaveChanges(updatedBook, false);
    } catch (error) {
      console.error("Error generating inline image:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error || "Failed to generate inline image."
      );
    } finally {
      setIsGeneratingChapterImage(false);
      setActiveEditorLockMessage("");
    }
  };

  useEffect(() => {
    if (!book || isLoading || pendingRegenerationReview) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSaveChanges(book, false);
    }, 1500);

    return () => clearTimeout(autosaveTimerRef.current);
  }, [book, handleSaveChanges, isLoading, pendingRegenerationReview]);

  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pendingRegenerationReview) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingRegenerationReview]);

  const handleGenerateFullBook = () => {
    const hasExistingContent = book.chapters.some(
      (chapter) => chapter.content?.trim().length > 0
    );
    const hasBible = hasBibleContent(book.bible);
    const hasVisualBible = hasVisualBibleContent(book.visualBible);
    const hasSourceFiles = Array.isArray(book.sourceFiles) && book.sourceFiles.length > 0;
    const canUseSourceFiles =
      book.generation?.provider === "gemini" && hasSourceFiles;

    setRegenerateOptions({
      replaceExistingContent: hasExistingContent,
      useBible: hasBible || hasVisualBible,
      generateImages: Boolean(book.generation?.includeImages),
      hasBible,
      hasVisualBible,
      hasSourceFiles,
      canUseSourceFiles,
      useSourceFiles: canUseSourceFiles,
      regenerateOutlineFromSource: canUseSourceFiles,
      generateBibleFromSource: canUseSourceFiles,
    });
  };

  const startFullBookGeneration = async (options = regenerateOptions) => {
    if (!options) {
      return;
    }

    setRegenerateOptions(null);
    setActiveEditorLockMessage(
      "Regenerating the full book. Editing is paused while chapters are being replaced."
    );
    setIsGenerating(true);
    let pollKey = null;
    const useBibleForInput = Boolean(options.useBible);
    const generateImages = Boolean(options.generateImages);
    const useSourceFiles =
      Boolean(options.useSourceFiles) && book.generation?.provider === "gemini";
    const visualBibleForGeneration =
      generateImages || useBibleForInput ? book.visualBible : { enabled: false };
    const originalBookSnapshot = cloneBookSnapshot(book);

    regenerationOriginalBookRef.current = originalBookSnapshot;
    allowRegenerationNavigationRef.current = false;
    setPendingRegenerationReview(null);

    try {
      const {
        data: { job },
      } = await axiosInstance.post(
        API_ENDPOINTS.AI.FULL_BOOK_JOBS,
        {
          bookId,
          title: book.title,
          subtitle: book.subtitle,
          author: book.author,
          topic: book.generation?.sourcePrompt || book.title,
          style: book.generation?.style || "Informative",
          chapterCount: book.chapters.length,
          genre: book.genre || "Nonfiction",
          audience: book.audience || "General readers",
          outline: book.chapters,
          provider: book.generation?.provider || "groq",
          useGoogleSearch:
            book.generation?.provider === "gemini" &&
            Boolean(book.generation?.useGoogleSearch),
          includeTextGraphics: Boolean(book.generation?.includeTextGraphics),
          includeImages: generateImages,
          generateImages,
          includeCover: generateImages && !book.coverImage,
          generateCover: generateImages && !book.coverImage,
          chapterLength: book.generation?.chapterLength || "medium",
          useBibleForInput,
          useBibleForImages: generateImages,
          bible: useBibleForInput ? book.bible : undefined,
          sourceFiles: useSourceFiles ? book.sourceFiles : undefined,
          useSourceFiles,
          regenerateFromSource: useSourceFiles,
          regenerateOutlineFromSource:
            useSourceFiles && Boolean(options.regenerateOutlineFromSource),
          generateBibleFromSource:
            useSourceFiles && Boolean(options.generateBibleFromSource),
          visualBible: visualBibleForGeneration,
        }
      );

      setGenerationJob(job);
      toast.success("Generation job started.");
      pollKey = Symbol(job.id);
      activeGenerationPollRef.current = pollKey;

      while (activeGenerationPollRef.current === pollKey) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (activeGenerationPollRef.current !== pollKey) return;

        const {
          data: { job: nextJob, book: nextBook },
        } = await axiosInstance.get(
          `${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${job.id}`
        );

        if (activeGenerationPollRef.current !== pollKey) return;

        setGenerationJob(nextJob);

        if (nextBook) {
          const normalizedNextBook = normalizeBook(nextBook) || book;
          skipNextAutosaveRef.current = true;
          setBook(normalizedNextBook);

          if (["complete", "failed"].includes(nextJob.status)) {
            setPendingRegenerationReview({
              originalBook: originalBookSnapshot,
              regeneratedBook: normalizedNextBook,
              status: nextJob.status,
              targetPath: "",
            });
          }
        }

        if (["complete", "failed", "cancelled"].includes(nextJob.status)) {
          activeGenerationPollRef.current = null;
          setIsGenerating(false);
          if (nextJob.status === "cancelled") {
            regenerationOriginalBookRef.current = null;
          }
          toast.success(
            nextJob.status === "complete"
              ? "Full book generated successfully!"
              : nextJob.status === "failed"
                ? "Book generated with failed chapters."
                : "Generation cancelled."
          );
          break;
        }
      }
    } catch (error) {
      console.error("Error generating full book:", error);
      toast.error(
        error.response?.status === 404
          ? "Generation was interrupted. Start a new full-book generation."
          : error.response?.data?.error || "Failed to generate the full book."
      );
    } finally {
      if (!pollKey || activeGenerationPollRef.current === pollKey) {
        activeGenerationPollRef.current = null;
        setIsGenerating(false);
        setActiveEditorLockMessage("");
      }
    }
  };

  const handleCancelGeneration = async () => {
    if (!generationJob?.id) return;

    try {
      const {
        data: { job },
      } = await axiosInstance.delete(
        `${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${generationJob.id}`
      );

      setGenerationJob(job);
    } catch (error) {
      console.error("Error cancelling generation:", error);
      toast.error("Failed to cancel generation.");
    }
  };

  const handleRetryFailedChapters = async () => {
    if (!generationJob?.id) return;

    setIsGenerating(true);

    try {
      const {
        data: { job },
      } = await axiosInstance.post(
        `${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${generationJob.id}/retry`
      );

      setGenerationJob(job);
      toast.success("Retry job queued.");
      navigate("/jobs");
    } catch (error) {
      console.error("Error retrying generation:", error);
      toast.error("Failed to retry failed chapters.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    const loadingToast = toast.loading("Generating PDF...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.PDF}/${bookId}/pdf`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const linkEl = document.createElement("a");
      linkEl.href = url;
      linkEl.setAttribute("download", `${book.title}.pdf`);
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export PDF!");
    }
  };

  const handleExportDocx = async () => {
    const loadingToast = toast.loading("Generating document...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.DOCX}/${bookId}/docx`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const linkEl = document.createElement("a");
      linkEl.href = url;
      linkEl.setAttribute("download", `${book.title}.docx`);
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Document downloaded successfully!");
    } catch (error) {
      console.error("Error exporting docx:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export document!");
    }
  };

  const handleExportEpub = async () => {
    const loadingToast = toast.loading("Generating EPUB...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.EPUB}/${bookId}/epub`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([data], { type: "application/epub+zip" })
      );
      const linkEl = document.createElement("a");
      linkEl.href = url;
      linkEl.setAttribute("download", `${book.title}.epub`);
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("EPUB downloaded successfully!");
    } catch (error) {
      console.error("Error exporting EPUB:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export EPUB!");
    }
  };

  const handleExportMarkdown = async () => {
    const loadingToast = toast.loading("Generating markdown...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.MARKDOWN}/${bookId}/markdown`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([data], { type: "text/markdown" })
      );
      const linkEl = document.createElement("a");
      linkEl.href = url;
      linkEl.setAttribute("download", `${book.title}.md`);
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Markdown downloaded successfully!");
    } catch (error) {
      console.error("Error exporting markdown:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export markdown!");
    }
  };

  const handleDownloadContinuityReport = async () => {
    if (!String(continuityReport || "").trim()) {
      toast.error("Run a continuity check first.");
      return;
    }

    setIsDownloadingContinuityReport(true);
    const loadingToast = toast.loading("Generating continuity report PDF...");

    try {
      const { data } = await axiosInstance.post(
        `${API_ENDPOINTS.EXPORTS.CONTINUITY_REPORT}/${bookId}/continuity-report.pdf`,
        { report: continuityReport },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([data], { type: "application/pdf" })
      );
      const linkEl = document.createElement("a");
      const safeTitle = String(book?.title || "book").replace(
        /[^a-zA-Z0-9-_]+/g,
        "_"
      );

      linkEl.href = url;
      linkEl.setAttribute("download", `${safeTitle}_continuity_report.pdf`);
      document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Continuity report downloaded.");
    } catch (error) {
      console.error("Error exporting continuity report:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error || "Failed to export continuity report."
      );
    } finally {
      setIsDownloadingContinuityReport(false);
    }
  };

  const handleCreatePreviewShare = async () => {
    setIsPreviewShareSaving(true);

    try {
      const saved = await handleSaveChanges(book, false);

      if (!saved) return;

      const { data } = await axiosInstance.post(
        `${API_ENDPOINTS.BOOKS.PREVIEW_SHARE}/${bookId}/preview-share`
      );
      const nextBook = normalizeBook(data?.book);

      if (nextBook) {
        setBook(nextBook);
      }

      const shareUrl = getPublicShareUrl(data?.previewShare?.token, user?.name);

      if (shareUrl && (await copyToClipboard(shareUrl))) {
        toast.success("Preview link created and copied.");
      } else {
        toast.success("Preview link created.");
      }
    } catch (error) {
      console.error("Error creating preview share:", error);
      toast.error("Failed to create preview link.");
    } finally {
      setIsPreviewShareSaving(false);
    }
  };

  const handleCopyPreviewShare = async () => {
    const token = book?.previewShare?.token || "";
    const shareUrl = getPublicShareUrl(token, user?.name);

    if (shareUrl && (await copyToClipboard(shareUrl))) {
      toast.success("Preview link copied.");
    } else {
      toast.error("Could not copy the preview link.");
    }
  };

  const handleOpenPreviewShare = () => {
    const shareUrl = getPublicShareUrl(book?.previewShare?.token, user?.name);

    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRevokePreviewShare = async () => {
    setIsPreviewShareSaving(true);

    try {
      const { data } = await axiosInstance.delete(
        `${API_ENDPOINTS.BOOKS.PREVIEW_SHARE}/${bookId}/preview-share`
      );
      const nextBook = normalizeBook(data?.book);

      if (nextBook) {
        setBook(nextBook);
      }

      toast.success("Preview link revoked.");
    } catch (error) {
      console.error("Error revoking preview share:", error);
      toast.error("Failed to revoke preview link.");
    } finally {
      setIsPreviewShareSaving(false);
    }
  };

  const handleOpenCommunityListing = () => {
    setCommunityPurchaseUrl(
      book?.communityListing?.purchaseUrl || user?.storeUrl || ""
    );
    setCommunityFreePdfEnabled(
      Boolean(book?.communityListing?.freeFullPdfEnabled)
    );
    setCommunityPurchaseUrlError("");
    setIsCommunityListingOpen(true);
  };

  const handleOpenCommunityBookshelf = () => {
    window.open("/community", "_blank", "noopener,noreferrer");
  };

  const handleUpdateCommunityListing = async (isListed) => {
    const { url, error } = isListed
      ? normalizeOptionalHttpUrl(communityPurchaseUrl)
      : {
          url: book?.communityListing?.purchaseUrl || "",
          error: "",
        };

    if (error) {
      setCommunityPurchaseUrlError(error);
      return;
    }

    setCommunityPurchaseUrlError("");
    setIsCommunityListingSaving(true);

    try {
      const saved = await handleSaveChanges(book, false);

      if (!saved) return;

      const { data } = await axiosInstance.patch(
        `${API_ENDPOINTS.BOOKS.COMMUNITY_LISTING}/${bookId}/community-listing`,
        {
          isListed,
          purchaseUrl: url,
          freeFullPdfEnabled: isListed && communityFreePdfEnabled,
        }
      );
      const nextBook = normalizeBook(data?.book);

      if (nextBook) {
        skipNextAutosaveRef.current = true;
        setBook(nextBook);
      }

      setIsCommunityListingOpen(false);
      toast.success(
        isListed
          ? communityFreePdfEnabled
            ? "Book posted with free PDF access."
            : "Book posted to the community shelf."
          : "Book removed from the community shelf."
      );
    } catch (error) {
      console.error("Error updating community listing:", error);
      toast.error(
        error.response?.data?.error || "Failed to update community listing."
      );
    } finally {
      setIsCommunityListingSaving(false);
    }
  };

  const handleAiTool = async (action, tone = "") => {
    if (isGenerating || isGeneratingChapterImage) {
      toast.error("Wait for the current AI update to finish first.");
      return;
    }

    const currentChapter = book.chapters[selectedChapterIndex];

    if (!currentChapter?.content?.trim()) {
      toast.error("This chapter needs content before using AI tools.");
      return;
    }

    const toolLabel = AI_TOOL_LABELS[action] || "AI tool";
    setActiveEditorLockMessage(
      `${toolLabel} is running on "${currentChapter.title || `Chapter ${selectedChapterIndex + 1}`}". Editing is paused so the review diff stays accurate.`
    );
    setIsGenerating(true);
    const loadingToast = toast.loading(`${toolLabel} is running...`);

    try {
      const {
        data: { content },
      } = await axiosInstance.post(API_ENDPOINTS.AI.QUALITY_TOOL, {
        action,
        tone,
        content: currentChapter.content,
        provider: book.generation?.provider || "groq",
        bookTitle: book.title,
        chapterTitle: currentChapter.title,
        genre: book.genre || "Nonfiction",
        audience: book.audience || "General readers",
        bookBible: book.bible,
        visualBible: book.visualBible,
      });

      const proposedContent = buildAiToolProposal({
        action,
        originalContent: currentChapter.content,
        aiContent: content,
      });

      setPendingAiToolReview({
        action,
        aiContent: content,
        chapterIndex: selectedChapterIndex,
        chapterTitle: currentChapter.title,
        diffRows: buildLineDiff(currentChapter.content, proposedContent),
        label: toolLabel,
        originalContent: currentChapter.content,
        proposedContent,
        wordDelta: getWordDelta(currentChapter.content, proposedContent),
      });
      toast.dismiss(loadingToast);
      toast.success("AI tool ready to review.");
    } catch (error) {
      console.error("Error running AI tool:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "AI tool failed.");
    } finally {
      setIsGenerating(false);
      setActiveEditorLockMessage("");
    }
  };

  const handleBibleTool = async (action) => {
    const currentChapter = book.chapters[selectedChapterIndex];
    const manuscriptContext = buildBookManuscriptContext(book);
    const currentChapterContext = currentChapter
      ? `# ${currentChapter.title || "Current chapter"}\n${
          currentChapter.description ? `${currentChapter.description}\n\n` : ""
        }${currentChapter.content || ""}`
      : "";
    const content =
      action === "bible_update" ? currentChapterContext : manuscriptContext;

    if (!String(content || "").trim()) {
      toast.error("Add chapter content before running Book Bible tools.");
      return;
    }

    setRunningBibleTool(action);
    const loadingToast = toast.loading(
      action === "continuity_check"
        ? "Checking continuity..."
        : "Building Book Bible..."
    );

    try {
      const {
        data: { content: aiContent },
      } = await axiosInstance.post(API_ENDPOINTS.AI.QUALITY_TOOL, {
        action,
        content,
        provider: book.generation?.provider || "gemini",
        bookTitle: book.title,
        chapterTitle:
          action === "bible_update" ? currentChapter?.title || "" : "",
        genre: book.genre || "Nonfiction",
        audience: book.audience || "General readers",
        bookBible: book.bible,
        visualBible: book.visualBible,
      });

      toast.dismiss(loadingToast);

      if (action === "continuity_check") {
        setContinuityReport(aiContent);
        setActiveTab("bible");
        toast.success("Continuity report ready.");
        return;
      }

      if (action === "bible_extract") {
        const nextBook = {
          ...book,
          bible: {
            ...DEFAULT_BOOK_BIBLE,
            ...parseBibleToolContent(aiContent),
            updatedAt: new Date().toISOString(),
          },
        };

        skipNextAutosaveRef.current = true;
        setPendingBibleReview(null);
        setBook(nextBook);
        setActiveTab("bible");

        const saved = await handleSaveChanges(nextBook, false);

        if (saved) {
          toast.success("Book Bible extracted and saved.");
        } else {
          toast.error("Book Bible extracted, but save failed.");
        }
        return;
      }

      setPendingBibleReview({
        action,
        bible: parseBibleToolContent(aiContent),
        raw: aiContent,
      });
      setActiveTab("bible");
      toast.success("Book Bible update ready to review.");
    } catch (error) {
      console.error("Error running Book Bible tool:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Book Bible tool failed.");
    } finally {
      setRunningBibleTool("");
    }
  };

  const handleApplyBibleReview = async () => {
    if (!pendingBibleReview) return;

    const nextBook = {
      ...book,
      bible: {
        ...DEFAULT_BOOK_BIBLE,
        ...pendingBibleReview.bible,
        updatedAt: new Date().toISOString(),
      },
    };

    skipNextAutosaveRef.current = true;
    setBook(nextBook);
    setPendingBibleReview(null);
    await handleSaveChanges(nextBook, false);
    toast.success("Book Bible saved.");
  };

  const handleApplyAiToolReview = async () => {
    if (!pendingAiToolReview) return;

    const updatedChapters = [...book.chapters];

    if (!updatedChapters[pendingAiToolReview.chapterIndex]) {
      toast.error("The target chapter no longer exists.");
      setPendingAiToolReview(null);
      return;
    }

    updatedChapters[pendingAiToolReview.chapterIndex] = {
      ...updatedChapters[pendingAiToolReview.chapterIndex],
      content: pendingAiToolReview.proposedContent,
      wordCount: countWords(pendingAiToolReview.proposedContent),
    };

    const updatedBook = { ...book, chapters: updatedChapters };

    skipNextAutosaveRef.current = true;
    setBook(updatedBook);
    setSelectedChapterIndex(pendingAiToolReview.chapterIndex);
    setPendingAiToolReview(null);
    await handleSaveChanges(updatedBook, false);
    toast.success("AI changes applied.");
  };

  if (isLoading || !book) {
    return (
      <main className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="size-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Loading Editor...</p>
        </div>
      </main>
    );
  }

  const isCommunityListed = Boolean(book?.communityListing?.isListed);

  return (
    <div className="min-h-screen bg-slate-50 font-display flex relative">
      <Modal
        isOpen={Boolean(newChapterOptions)}
        onClose={() => setNewChapterOptions(null)}
        title="Add new chapter"
        sizeClassName="max-w-xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setNewChapterOptions(null)}
              disabled={isGenerating || isGeneratingChapterImage}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="new-chapter-form"
              icon={newChapterOptions?.startBlank ? Save : Sparkles}
              isLoading={isGenerating || isGeneratingChapterImage}
            >
              {newChapterOptions?.startBlank
                ? "Start Blank"
                : newChapterOptions?.generateImage
                  ? "Write Chapter & Image"
                  : "Write Chapter"}
            </Button>
          </div>
        }
      >
        {newChapterOptions && (
          <form
            id="new-chapter-form"
            onSubmit={handleCreateNewChapter}
            className="space-y-4"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
              <input
                type="checkbox"
                checked={Boolean(newChapterOptions.startBlank)}
                onChange={(event) =>
                  setNewChapterOptions((current) => ({
                    ...current,
                    startBlank: event.target.checked,
                    generateImage: event.target.checked
                      ? false
                      : current.generateImage,
                  }))
                }
                className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-slate-900">
                  Start blank
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Creates {`Chapter ${(book.chapters || []).length + 1}`} with
                  no AI text or image.
                </span>
              </span>
            </label>

            {!newChapterOptions.startBlank && (
              <>
                <Input
                  label="Chapter title"
                  name="new-chapter-title"
                  value={newChapterOptions.title}
                  onChange={(event) =>
                    setNewChapterOptions((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  placeholder="Chapter title"
                />

                <label className="grid grid-cols-1 gap-y-2">
                  <span className="text-gray-700 text-sm font-medium">
                    Chapter direction
                  </span>
                  <textarea
                    value={newChapterOptions.description}
                    onChange={(event) =>
                      setNewChapterOptions((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    maxLength={1200}
                    placeholder="What should this chapter continue, resolve, or introduce?"
                    className="w-full min-h-28 bg-white text-gray-900 text-sm placeholder-gray-400 px-3 py-2 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 resize-none"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
                  <input
                    type="checkbox"
                    checked={Boolean(newChapterOptions.generateImage)}
                    onChange={(event) =>
                      setNewChapterOptions((current) => ({
                        ...current,
                        generateImage: event.target.checked,
                      }))
                    }
                    className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Image className="size-4 text-violet-600" />
                      Generate image after writing
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Writes this chapter first, then inserts one chapter image
                      using the direction below.
                    </span>
                  </span>
                </label>

                {newChapterOptions.generateImage && (
                  <label className="grid grid-cols-1 gap-y-2">
                    <span className="text-gray-700 text-sm font-medium">
                      Image direction
                    </span>
                    <textarea
                      value={newChapterOptions.imagePrompt}
                      onChange={(event) =>
                        setNewChapterOptions((current) => ({
                          ...current,
                          imagePrompt: event.target.value,
                        }))
                      }
                      rows={4}
                      maxLength={1200}
                      placeholder="Scene, mood, characters, setting, camera angle, colors..."
                      className="w-full min-h-28 bg-white text-gray-900 text-sm placeholder-gray-400 px-3 py-2 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 resize-none"
                    />
                    <span className="text-xs text-slate-500">
                      Visual Bible references and generated chapter text will
                      also be used when available.
                    </span>
                  </label>
                )}
              </>
            )}
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(regenerateOptions)}
        onClose={() => setRegenerateOptions(null)}
        title="Regenerate full book"
        sizeClassName="max-w-xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRegenerateOptions(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              icon={Sparkles}
              isLoading={isGenerating}
              onClick={() => startFullBookGeneration(regenerateOptions)}
            >
              Start Regeneration
            </Button>
          </div>
        }
      >
        {regenerateOptions && (
          <div className="space-y-4">
            {regenerateOptions.replaceExistingContent && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This will replace generated chapter content in the current
                outline. Save anything you want to keep before starting.
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
              <input
                type="checkbox"
                checked={Boolean(regenerateOptions.useBible)}
                onChange={(event) =>
                  setRegenerateOptions((prev) => ({
                    ...prev,
                    useBible: event.target.checked,
                  }))
                }
                className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BookMarked className="size-4 text-violet-600" />
                  Use Book Bible as input
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Feeds saved canon, style notes, visual references, and
                  unresolved threads into the regeneration.
                </span>
                {!regenerateOptions.hasBible &&
                  !regenerateOptions.hasVisualBible && (
                    <span className="mt-2 block text-xs text-slate-400">
                      No saved Bible content detected yet.
                    </span>
                  )}
              </span>
            </label>

            {regenerateOptions.hasSourceFiles && (
              <label
                className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                  regenerateOptions.canUseSourceFiles
                    ? "cursor-pointer border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(regenerateOptions.useSourceFiles)}
                  disabled={!regenerateOptions.canUseSourceFiles}
                  onChange={(event) =>
                    setRegenerateOptions((prev) => ({
                      ...prev,
                      useSourceFiles: event.target.checked,
                      regenerateOutlineFromSource:
                        event.target.checked &&
                        Boolean(prev.regenerateOutlineFromSource),
                      generateBibleFromSource:
                        event.target.checked && Boolean(prev.generateBibleFromSource),
                    }))
                  }
                  className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileText className="size-4 text-violet-600" />
                    Regenerate from source files
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Uses {book.sourceFiles?.length || 0} saved source{" "}
                    {(book.sourceFiles?.length || 0) === 1 ? "file" : "files"} as
                    Gemini reference material.
                  </span>
                  {!regenerateOptions.canUseSourceFiles && (
                    <span className="mt-2 block text-xs text-amber-700">
                      Source regeneration requires the Gemini 3.5 Flash Book Engine.
                    </span>
                  )}
                </span>
              </label>
            )}

            {regenerateOptions.canUseSourceFiles &&
              regenerateOptions.useSourceFiles && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(regenerateOptions.regenerateOutlineFromSource)}
                      onChange={(event) =>
                        setRegenerateOptions((prev) => ({
                          ...prev,
                          regenerateOutlineFromSource: event.target.checked,
                        }))
                      }
                      className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Rebuild outline
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                        Replace the current chapter plan from the source files.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(regenerateOptions.generateBibleFromSource)}
                      onChange={(event) =>
                        setRegenerateOptions((prev) => ({
                          ...prev,
                          generateBibleFromSource: event.target.checked,
                        }))
                      }
                      className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Rebuild Bible
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                        Refresh Source and canon notes from the saved documents.
                      </span>
                    </span>
                  </label>
                </div>
              )}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/40">
              <input
                type="checkbox"
                checked={Boolean(regenerateOptions.generateImages)}
                onChange={(event) =>
                  setRegenerateOptions((prev) => ({
                    ...prev,
                    generateImages: event.target.checked,
                  }))
                }
                className="mt-1 size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Image className="size-4 text-violet-600" />
                  Generate images
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Uses Visual Bible references for chapter illustrations and
                  creates a cover only when this book does not already have one.
                </span>
                {!regenerateOptions.hasVisualBible && (
                  <span className="mt-2 block text-xs text-amber-600">
                    Add Visual Bible references first for the strongest image
                    consistency.
                  </span>
                )}
              </span>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(pendingRegenerationReview?.targetPath)}
        onClose={handleCloseRegenerationLeavePrompt}
        title="Save regenerated book?"
        sizeClassName="max-w-lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseRegenerationLeavePrompt}
            >
              Stay in Editor
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isSaving}
              onClick={handleDiscardRegeneratedAndContinue}
            >
              Don't Save
            </Button>
            <Button
              type="button"
              icon={Save}
              isLoading={isSaving}
              onClick={handleSaveRegeneratedAndContinue}
            >
              Save & Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-sm font-semibold text-violet-950">
              The regenerated version has not been accepted yet.
            </p>
            <p className="mt-1 text-sm text-violet-800">
              Save it to overwrite the previous book, or discard it to restore
              the version from before regeneration and continue leaving.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Save & Continue
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Keeps the regenerated chapters and moves forward.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Don't Save
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Restores the previous book, then moves forward.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCommunityListingOpen}
        onClose={() => {
          if (!isCommunityListingSaving) {
            setIsCommunityListingOpen(false);
          }
        }}
        title="Community bookshelf"
        sizeClassName="max-w-2xl"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              icon={ExternalLink}
              onClick={handleOpenCommunityBookshelf}
              disabled={isCommunityListingSaving}
              className="border-[#d7ccba] text-[#171717] hover:bg-[#eef3ff] hover:border-[#1d4ed8]"
            >
              Open Community
            </Button>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCommunityListingOpen(false)}
                disabled={isCommunityListingSaving}
              >
                Cancel
              </Button>
              {isCommunityListed && (
                <Button
                  type="button"
                  variant="destructive"
                  isLoading={isCommunityListingSaving}
                  onClick={() => handleUpdateCommunityListing(false)}
                >
                  Remove
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                icon={Library}
                isLoading={isCommunityListingSaving}
                onClick={() => handleUpdateCommunityListing(true)}
                className="bg-[#1d4ed8] text-white hover:bg-[#163ea8] focus:ring-[#1d4ed8]"
              >
                {isCommunityListed ? "Save Listing" : "Post Book"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-[#d7ccba] bg-[#fffaf0] px-4 py-3">
            <p className="text-sm font-semibold text-[#171717]">
              {isCommunityListed
                ? "This book is posted on the community bookshelf."
                : "Post this book on the community bookshelf."}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#56534d]">
              Community readers can discover it. If you enable FREE full PDF,
              they can view the whole book in a flipbook and download the PDF.
            </p>
          </div>

          <section>
            <p className="text-sm font-semibold text-slate-900">
              Listing type
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCommunityFreePdfEnabled(false)}
                aria-pressed={!communityFreePdfEnabled}
                className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] ${
                  !communityFreePdfEnabled
                    ? "border-[#1d4ed8] bg-[#eef3ff] shadow-sm"
                    : "border-slate-200 bg-white hover:border-[#d7ccba]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <Store className="size-4 text-[#1d4ed8]" />
                  Catalog
                </span>
                <span className="mt-2 block text-sm leading-6 text-slate-500">
                  Shows the book, preview link, and purchase link when available.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCommunityFreePdfEnabled(true)}
                aria-pressed={communityFreePdfEnabled}
                className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] ${
                  communityFreePdfEnabled
                    ? "border-[#1d4ed8] bg-[#eef3ff] shadow-sm"
                    : "border-slate-200 bg-white hover:border-[#d7ccba]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <FileText className="size-4 text-[#1d4ed8]" />
                  FREE full PDF
                </span>
                <span className="mt-2 block text-sm leading-6 text-slate-500">
                  Adds public view and download buttons for the full manuscript.
                </span>
              </button>
            </div>
          </section>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Store className="size-4 text-[#1d4ed8]" />
              Purchase link
            </span>
            <input
              value={communityPurchaseUrl}
              onChange={(event) => {
                setCommunityPurchaseUrl(event.target.value);
                setCommunityPurchaseUrlError("");
              }}
              placeholder="https://your-book-store-link.com"
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
            />
            {communityPurchaseUrlError ? (
              <span className="text-xs font-semibold text-red-600">
                {communityPurchaseUrlError}
              </span>
            ) : (
              <span className="text-xs leading-5 text-slate-500">
                Optional. Use this for paperback, hardcover, or store pages.
              </span>
            )}
          </label>

          {!book?.previewShare?.token && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-950">
                No preview link is active.
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Catalog listings work best with a preview link. FREE full PDF
                listings do not require one.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Mobile sidebar */}
      {isSidebarOpen && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Chapter navigation"
          className="flex fixed inset-0 z-40 md:hidden"
        >
          <div
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
            className="bg-black/20 backdrop-blur-sm fixed inset-0"
          />

          <nav className="flex-1 w-full max-w-xs bg-white flex flex-col relative">
            <div className="pt-2 -mr-12 absolute top-0 right-0">
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={() => setIsSidebarOpen(false)}
                className="size-10 rounded-full ml-1 flex justify-center items-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white hover:bg-white/10 transition-colors"
              >
                <X className="size-6 text-white" />
              </button>
            </div>

            <ChaptersSidebar
              book={book}
              selectedChapterIndex={selectedChapterIndex}
              onSelectChapter={(index) => {
                setSelectedChapterIndex(index);
                setIsSidebarOpen(false);
              }}
              onAddChapter={openNewChapterModal}
              onDeleteChapter={handleDeleteChapter}
              onBackToDashboard={() => requestEditorNavigation("/dashboard")}
              isGenerating={isGenerating}
              onGenerateChapterContent={handleGenerateChapterContent}
              onReorderChapters={handleReorderChapters}
              isCollapsed={false}
            />
          </nav>

          <div aria-hidden="true" className="shrink-0 w-14" />
        </aside>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:shrink-0 h-screen sticky top-0">
        <ChaptersSidebar
          book={book}
          selectedChapterIndex={selectedChapterIndex}
          onSelectChapter={(index) => {
            setSelectedChapterIndex(index);
            setIsSidebarOpen(false);
          }}
          onAddChapter={openNewChapterModal}
          onDeleteChapter={handleDeleteChapter}
          onBackToDashboard={() => requestEditorNavigation("/dashboard")}
          isGenerating={isGenerating}
          onGenerateChapterContent={handleGenerateChapterContent}
          onReorderChapters={handleReorderChapters}
          isCollapsed={isDesktopSidebarCollapsed}
          onToggleCollapse={() =>
            setIsDesktopSidebarCollapsed((isCollapsed) => !isCollapsed)
          }
        />
      </aside>

      <main className="flex-1 h-full flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm shadow-slate-200/40 backdrop-blur-sm sm:px-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                  className="md:hidden text-slate-500 p-2 rounded-lg transition-colors duration-200 hover:text-slate-800 hover:bg-slate-100 focus-visible:text-slate-800 focus-visible:bg-slate-100"
                >
                  <Menu className="size-6" />
                </button>

                {/* Tab switcher */}
                <nav className="hidden sm:flex items-center gap-x-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveTab("editor")}
                    className={`flex-1 ${
                      activeTab === "editor"
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700 focus-visible:text-slate-700"
                    } text-sm font-medium rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
                  >
                    <Edit className="size-4" />
                    <span className="hidden sm:inline">Editor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("bible")}
                    className={`flex-1 ${
                      activeTab === "bible"
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700 focus-visible:text-slate-700"
                    } text-sm font-medium whitespace-nowrap rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
                  >
                    <BookMarked className="size-4" />
                    <span className="hidden sm:inline">Bible</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={`flex-1 ${
                      activeTab === "details"
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700 focus-visible:text-slate-700"
                    } text-sm font-medium whitespace-nowrap rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
                  >
                    <NotebookText className="size-4" />
                    <span className="hidden sm:inline">Details</span>
                  </button>
                </nav>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <CreditBalancePill compact />

                <Button
                  type="button"
                  isLoading={isSaving}
                  onClick={handleManualSave}
                  icon={Save}
                  size="sm"
                  className="h-9 px-3 shadow-md shadow-violet-500/20"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <Dropdown
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    icon={WandSparkles}
                    size="sm"
                    ariaLabel="Open AI tools"
                    className="h-9 px-3"
                  >
                    AI Tools
                  </Button>
                }
              >
                <DropdownItem onClick={() => handleAiTool("rewrite")}>
                  Rewrite chapter
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("expand")}>
                  Expand chapter
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("shorten")}>
                  Shorten chapter
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("continue")}>
                  Continue writing
                </DropdownItem>
                <DropdownItem
                  onClick={() =>
                    handleAiTool("tone", "clear, warm, and commercially polished")
                  }
                >
                  Adjust tone
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("consistency")}>
                  Consistency check
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("sources")}>
                  Source warnings
                </DropdownItem>
                <DropdownItem onClick={() => handleAiTool("cover")}>
                  Cover prompt
                </DropdownItem>
                <DropdownItem onClick={() => handleBibleTool("continuity_check")}>
                  <BookMarked className="text-slate-500 size-4" />
                  Check book continuity
                </DropdownItem>
              </Dropdown>

              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateFullBook}
                isLoading={isGenerating}
                icon={Sparkles}
                size="sm"
                ariaLabel="Generate full book"
                title="Generate full book"
                className="h-9 px-3"
              >
                Full Book
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => requestEditorNavigation(`/books/${bookId}/kdp`)}
                icon={Store}
                size="sm"
                ariaLabel="Open KDP Studio"
                title="Open KDP Studio"
                className="h-9 px-3"
              >
                KDP
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  requestEditorNavigation(`/books/${bookId}/audiobook`)
                }
                icon={Headphones}
                size="sm"
                ariaLabel="Open Audiobook studio"
                title="Open Audiobook studio"
                className="h-9 px-3"
              >
                Audiobook
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  requestEditorNavigation(`/books/${bookId}/translation`)
                }
                icon={Languages}
                size="sm"
                ariaLabel="Open Translation Studio"
                title="Open Translation Studio"
                className="h-9 px-3"
              >
                Translation
              </Button>

              <Dropdown
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    icon={Share2}
                    size="sm"
                    isLoading={isPreviewShareSaving}
                    ariaLabel="Preview sharing"
                    className="h-9 px-3"
                  >
                    <span className="inline-flex items-center gap-1">
                      Preview
                      <ChevronDown className="size-4" />
                    </span>
                  </Button>
                }
              >
                {book?.previewShare?.token ? (
                  <>
                    <DropdownItem onClick={handleCopyPreviewShare}>
                      <Copy className="text-slate-500 size-4" />
                      Copy preview link
                    </DropdownItem>
                    <DropdownItem onClick={handleOpenPreviewShare}>
                      <ExternalLink className="text-slate-500 size-4" />
                      Open preview page
                    </DropdownItem>
                    <DropdownItem onClick={handleRevokePreviewShare}>
                      <Unlink className="text-red-500 size-4" />
                      Revoke preview link
                    </DropdownItem>
                  </>
                ) : (
                  <DropdownItem onClick={handleCreatePreviewShare}>
                    <Share2 className="text-slate-500 size-4" />
                    Create preview link
                  </DropdownItem>
                )}
              </Dropdown>

              <Button
                type="button"
                variant={isCommunityListed ? "secondary" : "outline"}
                onClick={handleOpenCommunityListing}
                icon={Library}
                size="sm"
                isLoading={isCommunityListingSaving}
                ariaLabel="Community bookshelf listing"
                title="Community bookshelf listing"
                className="h-9 px-3"
              >
                {isCommunityListed ? "Posted" : "Community"}
              </Button>

              <Dropdown
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    icon={FileDown}
                    size="sm"
                    ariaLabel="Export book"
                    className="h-9 px-3"
                  >
                    <span className="inline-flex items-center gap-1">
                      Export
                      <ChevronDown className="size-4" />
                    </span>
                  </Button>
                }
              >
                <DropdownItem onClick={handleExportPDF}>
                  <FileText className="text-slate-500 size-4" />
                  Export as PDF
                </DropdownItem>

                <DropdownItem onClick={handleExportDocx}>
                  <FileCode className="text-slate-500 size-4" />
                  Export as Docx
                </DropdownItem>

                <DropdownItem onClick={handleExportEpub}>
                  <FileArchive className="text-slate-500 size-4" />
                  Export as EPUB
                </DropdownItem>

                <DropdownItem onClick={handleExportMarkdown}>
                  <FileType className="text-slate-500 size-4" />
                  Export as Markdown
                </DropdownItem>
              </Dropdown>
            </div>

            {pendingRegenerationReview && (
              <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-950">
                      Review regenerated book before saving
                    </p>
                    <p className="mt-1 text-xs text-amber-800 sm:text-sm">
                      Browse the chapters now. Autosave is paused until you save
                      the regenerated version or restore the previous book.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      isLoading={isSaving}
                      onClick={handleDiscardRegeneratedDraft}
                    >
                      Restore Previous
                    </Button>
                    <Button
                      type="button"
                      icon={Save}
                      isLoading={isSaving}
                      onClick={handleSaveRegeneratedDraft}
                    >
                      Save Regenerated
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </header>

        {/* Translation active notice banner */}
        {book?.activeTextLanguage && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-amber-900 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Languages className="size-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  You are editing the <span className="underline font-bold">{book.activeTextLanguage}</span> translation of this book.
                </p>
                <p className="text-[11px] text-amber-700 truncate">
                  Changes will be saved to the translation. The original English manuscript remains untouched.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => requestEditorNavigation(`/books/${bookId}/translation`)}
              className="text-[11px] bg-white hover:bg-amber-100 border-amber-300 text-amber-950 font-medium py-1 px-2.5 self-start sm:self-center"
            >
              Translation Studio
            </Button>
          </div>
        )}

        {generationJob && (
          <section className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-emerald-950 text-sm font-semibold capitalize">
                {generationJob.status}
              </p>
              <p className="text-emerald-800 text-xs">
                {generationJob.progress?.message || "Generating"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-48 h-2 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      generationJob.progress?.total
                        ? ((generationJob.progress.completed +
                            generationJob.progress.failed) /
                            generationJob.progress.total) *
                          100
                        : 5
                    }%`,
                  }}
                />
              </div>

              {isGenerating && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelGeneration}
                >
                  Cancel
                </Button>
              )}

              {generationJob.status === "failed" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRetryFailedChapters}
                >
                  Retry Failed
                </Button>
              )}
            </div>
          </section>
        )}

        {pendingAiToolReview && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="min-h-screen px-4 py-6 flex items-center justify-center">
              <div
                className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
                aria-hidden="true"
                onClick={() => setPendingAiToolReview(null)}
              />

              <article
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-review-title"
                className="relative w-full max-w-6xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
              >
                <header className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase font-semibold tracking-wide text-violet-600">
                      Review Before Applying
                    </p>
                    <h2
                      id="ai-review-title"
                      className="text-slate-950 text-lg sm:text-xl font-bold mt-1"
                    >
                      {pendingAiToolReview.label}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 truncate">
                      {pendingAiToolReview.chapterTitle ||
                        `Chapter ${pendingAiToolReview.chapterIndex + 1}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPendingAiToolReview(null)}
                    aria-label="Close AI review"
                    className="text-slate-500 rounded-lg p-2 hover:bg-slate-100 focus-visible:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <X className="size-5" />
                  </button>
                </header>

                <section className="px-4 sm:px-6 py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[11px] uppercase text-slate-400 font-semibold">
                      Current
                    </p>
                    <p className="text-slate-900 text-sm font-semibold">
                      {countWords(pendingAiToolReview.originalContent)} words
                    </p>
                  </div>

                  <div className="bg-violet-50 rounded-lg p-3">
                    <p className="text-[11px] uppercase text-violet-400 font-semibold">
                      Proposed
                    </p>
                    <p className="text-violet-950 text-sm font-semibold">
                      {countWords(pendingAiToolReview.proposedContent)} words
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[11px] uppercase text-slate-400 font-semibold">
                      Change
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        pendingAiToolReview.wordDelta >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {pendingAiToolReview.wordDelta >= 0 ? "+" : ""}
                      {pendingAiToolReview.wordDelta} words
                    </p>
                  </div>
                </section>

                <section className="max-h-[62vh] overflow-auto bg-white">
                  <div className="sticky top-0 z-10 px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                    <h3 className="text-slate-800 text-sm font-semibold">
                      Line diff
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                      <span className="text-rose-700">- Removed</span>
                      <span className="text-emerald-700">+ Added</span>
                    </div>
                  </div>

                  <div className="font-mono text-xs sm:text-sm">
                    {(pendingAiToolReview.diffRows || []).map((row, index) => {
                      const rowStyles = {
                        added: "bg-emerald-50 text-emerald-950",
                        removed: "bg-rose-50 text-rose-950",
                        same: "bg-white text-slate-700",
                        meta: "bg-slate-100 text-slate-500 italic",
                      };
                      const prefix =
                        row.type === "added"
                          ? "+"
                          : row.type === "removed"
                            ? "-"
                            : row.type === "meta"
                              ? "..."
                              : " ";

                      return (
                        <div
                          key={`${row.type}-${row.oldLine || 0}-${
                            row.newLine || 0
                          }-${index}`}
                          className={`grid grid-cols-[3rem_3rem_2.5rem_minmax(0,1fr)] border-b border-slate-100 ${
                            rowStyles[row.type] || rowStyles.same
                          }`}
                        >
                          <span className="px-2 py-1 text-right text-slate-400 select-none border-r border-slate-100">
                            {row.oldLine || ""}
                          </span>
                          <span className="px-2 py-1 text-right text-slate-400 select-none border-r border-slate-100">
                            {row.newLine || ""}
                          </span>
                          <span className="px-2 py-1 text-center select-none border-r border-slate-100">
                            {prefix}
                          </span>
                          <span className="px-3 py-1 whitespace-pre-wrap break-words">
                            {row.text || " "}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <footer className="px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-slate-500 text-xs sm:text-sm">
                    Nothing changes until you apply this result.
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPendingAiToolReview(null)}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      onClick={handleApplyAiToolReview}
                      icon={Save}
                    >
                      Apply Changes
                    </Button>
                  </div>
                </footer>
              </article>
            </div>
          </div>
        )}

        {/* Content area */}
        <section className="w-full flex-1 overflow-hidden">
          {activeTab === "editor" ? (
            <ChapterEditorTab
              book={book}
              selectedChapterIndex={selectedChapterIndex}
              onEditChapter={handleEditChapter}
              isGenerating={isGenerating}
              onGeneratingChapterContent={handleGenerateChapterContent}
              isGeneratingImage={isGeneratingChapterImage}
              onGenerateChapterImage={handleGenerateChapterImage}
              onGenerateInlineImageCommand={handleGenerateInlineImageCommand}
              isEditorLocked={isGenerating || isGeneratingChapterImage}
              editorLockMessage={
                activeEditorLockMessage ||
                "AI is updating this chapter. Wait until it finishes before editing."
              }
            />
          ) : activeTab === "bible" ? (
            <BookBibleTab
              book={book}
              onEditBible={handleEditBible}
              onEditVisualBibleMeta={handleEditVisualBibleMeta}
              onAddVisualReference={handleAddVisualReference}
              onEditVisualReference={handleEditVisualReference}
              onRemoveVisualReference={handleRemoveVisualReference}
              onUploadVisualReference={handleUploadVisualReference}
              onImportVisualReferenceUrl={handleImportVisualReferenceUrl}
              onAddSourceFiles={handleAddSourceFiles}
              onRemoveSourceFile={handleRemoveSourceFile}
              onGenerateBibleFromSource={handleGenerateBibleFromSource}
              isUploadingSourceFiles={isUploadingSourceFiles}
              isGeneratingSourceBible={isGeneratingSourceBible}
              onRunBibleTool={handleBibleTool}
              runningBibleTool={runningBibleTool}
              pendingBibleReview={pendingBibleReview}
              onApplyBibleReview={handleApplyBibleReview}
              onDiscardBibleReview={() => setPendingBibleReview(null)}
              continuityReport={continuityReport}
              onClearContinuityReport={() => setContinuityReport("")}
              onDownloadContinuityReport={handleDownloadContinuityReport}
              isDownloadingContinuityReport={isDownloadingContinuityReport}
            />
          ) : (
            <BookDetailsTab
              book={book}
              onEditBook={handleEditBook}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onCoverImageUpload={handleCoverImgUpload}
              isGeneratingCover={isGeneratingCover}
              onGenerateCoverImage={handleGenerateCoverImage}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default EditBookPage;
