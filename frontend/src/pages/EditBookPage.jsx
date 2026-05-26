import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_BASE_URL, API_ENDPOINTS } from "../utils/api-endpoints";
import {
  ChevronDown,
  Edit,
  FileCode,
  FileArchive,
  FileDown,
  FileText,
  FileType,
  Menu,
  NotebookText,
  Save,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  BookDetailsTab,
  Button,
  ChapterEditorTab,
  ChaptersSidebar,
  Dropdown,
  DropdownItem,
} from "../components";
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
  const [activeTab, setActiveTab] = useState("editor"); // "editor" | "details"
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isGeneratingChapterImage, setIsGeneratingChapterImage] =
    useState(false);
  const [pendingAiToolReview, setPendingAiToolReview] = useState(null);
  const [generationJob, setGenerationJob] = useState(null);
  const skipNextAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const activeGenerationPollRef = useRef(null);

  const { bookId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Fetch book on mount
  useEffect(() => {
    const fetchBook = async () => {
      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        skipNextAutosaveRef.current = true;
        setBook(data.book);
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

  const handleAddChapter = () => {
    const newChapter = {
      title: `Chapter ${book.chapters.length + 1}`,
      content: "",
    };
    const updatedChapters = [...book.chapters, newChapter];
    setBook((prev) => ({ ...prev, chapters: updatedChapters }));
    setSelectedChapterIndex(updatedChapters.length - 1);
  };

  const handleEditChapter = (name, value) => {
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

  const handleSaveChanges = useCallback(async (bookToSave = book, showToast = true) => {
    setIsSaving(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.BOOKS.UPDATE_CONTENT}/${bookId}`,
        bookToSave
      );

      if (data?.book) {
        skipNextAutosaveRef.current = true;
        setBook(data.book);
      }

      if (showToast) {
        toast.success("Changes saved successfully!");
      }
    } catch (error) {
      console.error("Error saving chapter content:", error);
      toast.error("Failed to save changes! Please try again.", {
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [book, bookId]);

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
      setBook(data.book);
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

  const handleGenerateChapterContent = async (index, providerOverride = null) => {
    const chapter = book.chapters[index];

    if (!chapter || !chapter.title) {
      toast.error("Chapter title is required to generate content!");
      return;
    }

    const provider = providerOverride || book.generation?.provider || "groq";
    const providerName = provider === "gemini" ? "Gemini" : "Groq";

    setIsGenerating(true);
    const loadingToast = toast.loading(
      `Generating chapter with ${providerName}...`
    );

    try {
      const {
        data: { content, stats },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_CHAPTER_CONTENT, {
        chapterTitle: chapter.title,
        chapterDescription: chapter.description || "",
        style: book.generation?.style || "Informative",
        provider,
        bookTitle: book.title,
        genre: book.genre || "Nonfiction",
        audience: book.audience || "General readers",
        bookContext: book.chapters
          .map(
            (item, chapterIndex) =>
              `${chapterIndex + 1}. ${item.title}: ${item.description || ""}`
          )
          .join("\n"),
      });

      const updatedChapters = [...book.chapters];
      updatedChapters[index].content = content;
      updatedChapters[index].generationStatus = "complete";
      updatedChapters[index].wordCount = content
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      updatedChapters[index].generationStats = stats
        ? { ...stats, provider }
        : { provider };
      const updatedBook = { ...book, chapters: updatedChapters };

      setBook(updatedBook);

      toast.dismiss(loadingToast);
      toast.success(`${providerName} content generated for "${chapter.title}"`, {
        duration: 3000,
      });

      await handleSaveChanges(updatedBook, false);
    } catch (error) {
      console.error("Error generating chapter content:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to generate chapter content.", { duration: 5000 });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCoverImage = async ({
    prompt,
    aspectRatio,
    imageSize,
    model,
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
      });

      skipNextAutosaveRef.current = true;
      setBook(nextBook);
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

  const handleGenerateChapterImage = async (index, options = {}) => {
    const chapter = book.chapters[index];

    if (!chapter) {
      toast.error("Select a chapter before generating an image.");
      return;
    }

    setIsGeneratingChapterImage(true);
    const loadingToast = toast.loading("Generating chapter image...");

    try {
      const {
        data: { book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_CHAPTER_IMAGE, {
        bookId,
        chapterIndex: index,
        ...options,
      });

      skipNextAutosaveRef.current = true;
      setBook(nextBook);
      toast.dismiss(loadingToast);
      toast.success("Chapter image inserted into markdown.");
    } catch (error) {
      console.error("Error generating chapter image:", error);
      toast.dismiss(loadingToast);
      toast.error(
        error.response?.data?.error || "Failed to generate chapter image."
      );
    } finally {
      setIsGeneratingChapterImage(false);
    }
  };

  const handleGenerateInlineImageCommand = async (index, command) => {
    const chapter = book.chapters[index];
    const prompt = command?.prompt?.trim();

    if (!chapter || !prompt) {
      toast.error("Type /generate image of something first.");
      return;
    }

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
        insertIntoContent: false,
      });
      const nextChapters = [...(nextBook?.chapters || book.chapters)];
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
        ...(nextBook || book),
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
    }
  };

  useEffect(() => {
    if (!book || isLoading) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSaveChanges(book, false);
    }, 1500);

    return () => clearTimeout(autosaveTimerRef.current);
  }, [book, handleSaveChanges, isLoading]);

  useEffect(() => {
    return () => {
      activeGenerationPollRef.current = null;
      clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const handleGenerateFullBook = async () => {
    const hasExistingContent = book.chapters.some(
      (chapter) => chapter.content?.trim().length > 0
    );

    if (
      hasExistingContent &&
      !window.confirm(
        "Generate the full book with AI? This will replace existing chapter content."
      )
    ) {
      return;
    }

    setIsGenerating(true);
    let pollKey = null;

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
          skipNextAutosaveRef.current = true;
          setBook(nextBook);
        }

        if (["complete", "failed", "cancelled"].includes(nextJob.status)) {
          activeGenerationPollRef.current = null;
          setIsGenerating(false);
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
      toast.success("Retry job started.");
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

  const handleAiTool = async (action, tone = "") => {
    const currentChapter = book.chapters[selectedChapterIndex];

    if (!currentChapter?.content?.trim()) {
      toast.error("This chapter needs content before using AI tools.");
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading("Running AI tool...");

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
        audience: book.audience || "General readers",
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
        label: AI_TOOL_LABELS[action] || "AI tool",
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
    }
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

  return (
    <div className="min-h-screen bg-slate-50 font-display flex relative">
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
              onAddChapter={handleAddChapter}
              onDeleteChapter={handleDeleteChapter}
              isGenerating={isGenerating}
              onGenerateChapterContent={handleGenerateChapterContent}
              onReorderChapters={handleReorderChapters}
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
          onAddChapter={handleAddChapter}
          onDeleteChapter={handleDeleteChapter}
          isGenerating={isGenerating}
          onGenerateChapterContent={handleGenerateChapterContent}
          onReorderChapters={handleReorderChapters}
        />
      </aside>

      <main className="flex-1 h-full flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-3 sm:p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
              className="md:hidden text-slate-500 p-2 rounded-lg transition-colors duration-200 hover:text-slate-800 hover:bg-slate-100 focus-visible:text-slate-800 focus-visible:bg-slate-100"
            >
              <Menu className="size-6" />
            </button>

            {/* Tab switcher */}
            <nav className="hidden sm:flex items-center gap-x-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`flex-1 ${
                  activeTab === "editor"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 focus-visible:text-slate-700"
                } text-sm font-medium rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
              >
                <Edit className="size-4" />
                <span className="hidden sm:inline">Editor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex-1 ${
                  activeTab === "details"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 focus-visible:text-slate-700"
                } text-sm font-medium whitespace-nowrap rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
              >
                <NotebookText className="size-4" />
                <span className="hidden sm:inline">Details</span>
              </button>
            </nav>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Dropdown
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  icon={WandSparkles}
                  size="sm"
                >
                  <span className="hidden lg:inline">AI Tools</span>
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
              <DropdownItem onClick={() => handleAiTool("tone", "clear, warm, and commercially polished")}>
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
            </Dropdown>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateFullBook}
              isLoading={isGenerating}
              icon={Sparkles}
              size="sm"
            >
              <span className="hidden lg:inline">Generate Full Book</span>
              <span className="lg:hidden">AI Book</span>
            </Button>

            <Dropdown
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  icon={FileDown}
                  size="sm"
                >
                  <span className="hidden sm:inline-flex items-center gap-1">
                    Export
                    <ChevronDown className="size-4" />
                  </span>

                  <span className="sm:hidden">
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

            <Button
              type="button"
              isLoading={isSaving}
              onClick={() => handleSaveChanges()}
              icon={Save}
              size="sm"
            >
              Save
            </Button>
          </div>
        </header>

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
