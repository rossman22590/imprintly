import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  FileText,
  Hash,
  Image as ImageIcon,
  Lightbulb,
  Link,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import Select from "./ui/Select";
import {
  AI_PROVIDERS,
  BOOK_GENRES,
  GROQ_TEXT_MODELS,
  WRITING_STYLES,
} from "../utils/constants";
import Button from "./ui/Button";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

const CHAPTER_LENGTH_OPTIONS = [
  { value: "small", label: "Small - focused" },
  { value: "medium", label: "Medium - detailed" },
  { value: "large", label: "Large - most pages" },
];
const EMPTY_VISUAL_BIBLE = {
  enabled: true,
  matchBookStyle: true,
  characters: [],
  styleReferences: [],
  worldReferences: [],
  notes: "",
};
const VISUAL_REFERENCE_SECTIONS = [
  {
    key: "characters",
    label: "Characters",
    nameLabel: "Character name",
    descriptionLabel: "Appearance / role",
    addLabel: "Add character",
  },
  {
    key: "styleReferences",
    label: "Style",
    nameLabel: "Style label",
    descriptionLabel: "Mood, palette, art direction",
    addLabel: "Add style ref",
  },
  {
    key: "worldReferences",
    label: "World / locations",
    nameLabel: "Place or object",
    descriptionLabel: "Setting look, recurring object, location notes",
    addLabel: "Add world ref",
  },
];

function createVisualReference() {
  return {
    id: `ref-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    label: "",
    description: "",
    imageUrl: "",
    sourceUrl: "",
  };
}

function hasVisualBibleContent(visualBible = EMPTY_VISUAL_BIBLE) {
  return VISUAL_REFERENCE_SECTIONS.some(({ key }) =>
    (visualBible[key] || []).some(
      (reference) =>
        reference.imageUrl ||
        reference.name ||
        reference.label ||
        reference.description
    )
  );
}

function CreateBookModal({ isOpen, onClose, onBookCreate }) {
  const [step, setStep] = useState(1);
  const [bookTitle, setBookTitle] = useState("");
  const [bookSubtitle, setBookSubtitle] = useState("");
  const [chapterCount, setChapterCount] = useState(5);
  const [chapterLength, setChapterLength] = useState("medium");
  const [chapters, setChapters] = useState([]);
  const [topic, setTopic] = useState("");
  const [writingStyle, setWritingStyle] = useState(WRITING_STYLES[0]);
  const [aiProvider, setAiProvider] = useState("groq");
  const [groqTextModel, setGroqTextModel] = useState(GROQ_TEXT_MODELS[0].value);
  const [bookGenre, setBookGenre] = useState(BOOK_GENRES[0]);
  const [audience, setAudience] = useState("General readers");
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [generateCover, setGenerateCover] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
  const [includeTextGraphics, setIncludeTextGraphics] = useState(false);
  const [visualBible, setVisualBible] = useState(EMPTY_VISUAL_BIBLE);
  const [uploadingReferenceId, setUploadingReferenceId] = useState("");
  const [generationStats, setGenerationStats] = useState(null);
  const [generationJob, setGenerationJob] = useState(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingFullBook, setIsGeneratingFullBook] = useState(false);
  const [isFinalisingBook, setIsFinalisingBook] = useState(false);

  const chaptersContainerRef = useRef(null);
  const activePollRef = useRef(null);

  const { user } = useAuthContext();

  const resetModal = () => {
    activePollRef.current = null;
    setStep(1);
    setBookTitle("");
    setBookSubtitle("");
    setChapterCount(5);
    setChapterLength("medium");
    setChapters([]);
    setTopic("");
    setWritingStyle(WRITING_STYLES[0]);
    setAiProvider("groq");
    setGroqTextModel(GROQ_TEXT_MODELS[0].value);
    setBookGenre(BOOK_GENRES[0]);
    setAudience("General readers");
    setUseGoogleSearch(false);
    setGenerateCover(true);
    setIncludeImages(false);
    setIncludeTextGraphics(false);
    setVisualBible(EMPTY_VISUAL_BIBLE);
    setUploadingReferenceId("");
    setGenerationStats(null);
    setGenerationJob(null);
    setIsGeneratingOutline(false);
    setIsGeneratingFullBook(false);
    setIsFinalisingBook(false);
  };

  const handleProviderChange = (event) => {
    const nextProvider = event.target.value;

    setAiProvider(nextProvider);

    if (nextProvider !== "gemini") {
      setUseGoogleSearch(false);
    }
  };

  const handleGenerateOutline = async () => {
    const parsedChapterCount =
      typeof chapterCount === "string" ? parseInt(chapterCount) : chapterCount;
    const validChapterCount = Number.isFinite(parsedChapterCount)
      ? Math.max(1, Math.min(26, parsedChapterCount))
      : 0;

    if (!bookTitle || !validChapterCount || validChapterCount < 1) {
      toast.error("Book title and a valid number of chapters are required!", {
        duration: 5000,
      });

      return;
    }

    setIsGeneratingOutline(true);

    try {
      const {
        data: { outline, generation, title, subtitle },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_OUTLINE, {
        topic: bookTitle,
        description: topic || "",
        style: writingStyle,
        chapterCount: validChapterCount,
        chapterLength,
        provider: aiProvider,
        model: aiProvider === "groq" ? groqTextModel : undefined,
        genre: bookGenre,
        audience,
        useGoogleSearch: aiProvider === "gemini" && useGoogleSearch,
      });

      if (title) {
        setBookTitle(title);
      }

      setBookSubtitle((subtitle || bookSubtitle || "").trim());
      setChapters(outline);
      setGenerationStats(generation || null);
      setStep(2);
      toast.success("Outline generated! Review and edit chapters if needed.");
    } catch (error) {
      console.error("Error generating book outline:", error);
      toast.error(
        error.response?.data?.message || "Failed to generate book outline."
      );
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleAddChapter = () => {
    if (chapters.length >= 26) {
      toast.error("AI book creation supports up to 26 chapters.");
      return;
    }

    setChapters((prev) => [
      ...prev,
      {
        title: `Chapter ${prev.length + 1}`,
        description: "",
      },
    ]);
  };

  const handleEditChapter = (index, field, value) => {
    const updatedChapters = [...chapters];
    updatedChapters[index][field] = value;
    setChapters(updatedChapters);
  };

  const handleDeleteChapter = (index) => {
    if (chapters.length <= 1) return;

    setChapters((prev) => [...prev].filter((_, i) => i !== index));
  };

  const updateVisualReference = (sectionKey, index, field, value) => {
    setVisualBible((current) => {
      const nextItems = [...(current[sectionKey] || [])];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };

      if (field === "name") {
        nextItems[index].label = value;
      }

      return {
        ...current,
        [sectionKey]: nextItems,
      };
    });
  };

  const addVisualReference = (sectionKey) => {
    setVisualBible((current) => ({
      ...current,
      [sectionKey]: [...(current[sectionKey] || []), createVisualReference()],
    }));
  };

  const removeVisualReference = (sectionKey, index) => {
    setVisualBible((current) => ({
      ...current,
      [sectionKey]: (current[sectionKey] || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadVisualReferenceFile = async (sectionKey, index, file) => {
    if (!file) return;

    const reference = visualBible[sectionKey]?.[index];
    const uploadKey = `${sectionKey}-${reference?.id || index}`;
    const formData = new FormData();

    formData.append("referenceImage", file);
    setUploadingReferenceId(uploadKey);

    try {
      const {
        data: { imageUrl },
      } = await axiosInstance.post(
        API_ENDPOINTS.BOOKS.UPLOAD_VISUAL_REFERENCE,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      updateVisualReference(sectionKey, index, "imageUrl", imageUrl);
      toast.success("Reference uploaded.");
    } catch (error) {
      console.error("Error uploading reference:", error);
      toast.error(error.response?.data?.error || "Reference upload failed.");
    } finally {
      setUploadingReferenceId("");
    }
  };

  const importVisualReferenceUrl = async (sectionKey, index) => {
    const reference = visualBible[sectionKey]?.[index];
    const sourceUrl = reference?.sourceUrl?.trim();

    if (!sourceUrl) {
      toast.error("Paste an image URL first.");
      return;
    }

    const uploadKey = `${sectionKey}-${reference?.id || index}`;
    setUploadingReferenceId(uploadKey);

    try {
      const {
        data: { imageUrl },
      } = await axiosInstance.post(API_ENDPOINTS.BOOKS.IMPORT_VISUAL_REFERENCE_URL, {
        url: sourceUrl,
      });

      updateVisualReference(sectionKey, index, "imageUrl", imageUrl);
      toast.success("Reference stored.");
    } catch (error) {
      console.error("Error importing reference URL:", error);
      toast.error(error.response?.data?.error || "Could not store image URL.");
    } finally {
      setUploadingReferenceId("");
    }
  };

  const getVisualBiblePayload = () => ({
    ...visualBible,
    enabled: includeImages && visualBible.enabled !== false,
    updatedAt: new Date().toISOString(),
  });

  const handleFinaliseBook = async () => {
    if (chapters.length === 0) {
      toast.error("At least one chapter is required!", { duration: 5000 });

      return;
    }

    setIsFinalisingBook(true);

    try {
      const { data } = await axiosInstance.post(API_ENDPOINTS.BOOKS.CREATE, {
        title: bookTitle,
        subtitle: bookSubtitle,
        author: user?.name || "Unknown Author",
        genre: bookGenre,
        audience,
        chapters,
        generation: {
          provider: aiProvider,
          status: "outline",
          style: writingStyle,
          useGoogleSearch: aiProvider === "gemini" && useGoogleSearch,
          includeTextGraphics,
          chapterLength,
          ...(aiProvider === "groq"
            ? { structureModel: groqTextModel, sectionModel: groqTextModel }
            : {}),
          ...(generationStats || {}),
        },
        visualBible: getVisualBiblePayload(),
        generateCover,
      });
      const { book } = data;

      toast.success(
        book.coverImage
          ? "Book draft and cover created successfully!"
          : "Book draft created successfully!"
      );
      if (data.coverError) {
        toast.error(`Cover generation failed: ${data.coverError}`);
      }
      onBookCreate(book._id);
      onClose();
      resetModal();
    } catch (error) {
      console.error("Error while creating book:", error);
      toast.error(error.response?.data?.message || "Failed to create book!");
    } finally {
      setIsFinalisingBook(false);
    }
  };

  const pollFullBookJob = async (jobId) => {
    const pollKey = Symbol(jobId);
    activePollRef.current = pollKey;

    while (activePollRef.current === pollKey) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (activePollRef.current !== pollKey) return;

      let response;

      try {
        response = await axiosInstance.get(
          `${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${jobId}`
        );
      } catch (error) {
        if (activePollRef.current !== pollKey) return;

        setIsGeneratingFullBook(false);
        activePollRef.current = null;
        toast.error(
          error.response?.status === 404
            ? "Generation was interrupted. Start a new full-book generation."
            : "Lost generation progress. Please try again."
        );
        return;
      }

      const {
        data: { job, book },
      } = response;

      setGenerationJob(job);

      if (["complete", "failed", "cancelled"].includes(job.status)) {
        setIsGeneratingFullBook(false);
        activePollRef.current = null;

        const hasGeneratedContent = Array.isArray(book?.chapters)
          ? book.chapters.some((chapter) => chapter.content?.trim())
          : false;

        if (book && job.status === "complete") {
          toast.success(
            "Full AI book generated!"
          );
          onBookCreate(book._id);
          onClose();
          resetModal();
        } else if (book && job.status === "failed" && hasGeneratedContent) {
          toast.error("Book generated with failed chapters.");
          onBookCreate(book._id);
          onClose();
          resetModal();
        } else if (job.status === "failed") {
          const failureReason =
            job.failedChapters?.[0]?.error ||
            job.error ||
            job.progress?.message ||
            "The AI provider did not return usable chapter content.";

          toast.error(failureReason, { duration: 8000 });
        } else if (job.status === "cancelled") {
          toast("Generation cancelled.");
        }

        return;
      }
    }
  };

  const handleGenerateFullBook = async () => {
    if (chapters.length === 0) {
      toast.error("Generate or add at least one chapter first.", {
        duration: 5000,
      });

      return;
    }

    setIsGeneratingFullBook(true);

    try {
      const {
        data: { job },
      } = await axiosInstance.post(
        API_ENDPOINTS.AI.FULL_BOOK_JOBS,
        {
          title: bookTitle,
          subtitle: bookSubtitle,
          author: user?.name || "Unknown Author",
          topic: bookTitle,
          description: topic || "",
          style: writingStyle,
          chapterCount: chapters.length,
          chapterLength,
          genre: bookGenre,
          audience,
          outline: chapters,
          provider: aiProvider,
          model: aiProvider === "groq" ? groqTextModel : undefined,
          generateCover,
          includeImages,
          includeTextGraphics,
          visualBible: getVisualBiblePayload(),
          useGoogleSearch: aiProvider === "gemini" && useGoogleSearch,
        }
      );

      setGenerationJob(job);
      toast.success("Generation job started.");
      await pollFullBookJob(job.id);
    } catch (error) {
      console.error("Error generating full book:", error);
      toast.error(
        error.response?.data?.error || "Failed to generate the full book."
      );
      setIsGeneratingFullBook(false);
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

  const outlineStats = generationStats?.stats;
  const isGeminiSearchGrounded = aiProvider === "gemini" && useGoogleSearch;

  useEffect(() => {
    if (step === 2 && chaptersContainerRef.current) {
      const scrollableDiv = chaptersContainerRef.current;
      scrollableDiv.scrollTo({
        top: scrollableDiv.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [step, chapters.length]);

  useEffect(() => {
    return () => {
      activePollRef.current = null;
    };
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        resetModal();
      }}
      sizeClassName="max-w-[min(64rem,calc(100vw-1rem))]"
      title="Create AI Book"
    >
      {step === 1 && (
        <div className="space-y-4 md:space-y-5">
          {/* Progress indicator */}
          <ol className="flex items-center gap-2 mb-4 md:mb-6">
            <li
              aria-label="Step 1"
              className="size-7 md:size-8 bg-violet-100 text-violet-600 text-xs md:text-sm font-semibold rounded-full flex justify-center items-center"
            >
              1
            </li>

            <div className="flex-1 h-0.5 bg-gray-200" />

            <li
              aria-label="Step 2"
              className="size-7 md:size-8 bg-gray-100 text-gray-400 text-xs md:text-sm font-semibold rounded-full flex justify-center items-center"
            >
              2
            </li>
          </ol>

          {/* Form inputs */}
          <Input
            type="text"
            value={bookTitle}
            onChange={(event) => setBookTitle(event.target.value)}
            icon={BookOpen}
            label="Book Title"
            required
            placeholder="What should we call your book?"
          />

          <Input
            type="text"
            value={bookSubtitle}
            onChange={(event) => setBookSubtitle(event.target.value)}
            icon={FileText}
            label="Subtitle"
            placeholder="Optional. AI can fill this after the outline."
            helperText="Leave blank if you want Bookify to suggest one from the outline."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              value={chapterCount}
              onChange={(event) => {
                const value = event.target.value;

                if (value === "") {
                  setChapterCount("");

                  return;
                }

                const parsed = parseInt(value);

                if (!isNaN(parsed)) {
                  setChapterCount(Math.max(1, Math.min(26, parsed)));
                }
              }}
              onBlur={(event) => {
                const value = event.target.value;

                if (value === "" || isNaN(parseInt(value))) {
                  setChapterCount(5);
                }
              }}
              icon={Hash}
              label="Number of Chapters"
              min="1"
              max="26"
              step="1"
              placeholder="5"
            />

            <Select
              name="chapterLength"
              value={chapterLength}
              onChange={(event) => setChapterLength(event.target.value)}
              options={CHAPTER_LENGTH_OPTIONS}
              icon={BookOpen}
              label="Chapter Length"
            />
          </div>

          <div className="w-full grid grid-cols-1 gap-y-2">
            <label
              htmlFor="book-topic"
              className="text-gray-700 text-sm font-medium"
            >
              Topic (Optional)
            </label>

            <div className="relative">
              <div className="pl-3 pt-3 pointer-events-none absolute inset-y-0 left-0">
                <Lightbulb className="size-4 text-gray-400" />
              </div>

              <textarea
                id="book-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={4}
                className="w-full min-h-28 resize-y bg-white text-gray-900 text-sm placeholder-gray-400 pl-10 pr-3 py-3 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Describe the book idea, angle, audience needs, must-cover points, or anything the AI should know."
              />
            </div>
          </div>

          <Select
            value={writingStyle}
            onChange={(event) => setWritingStyle(event.target.value)}
            options={WRITING_STYLES}
            icon={Palette}
            label="Writing Style"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              value={aiProvider}
              onChange={handleProviderChange}
              options={AI_PROVIDERS}
              icon={Bot}
              label="AI Provider"
            />

            <Select
              value={bookGenre}
              onChange={(event) => setBookGenre(event.target.value)}
              options={BOOK_GENRES}
              icon={FileText}
              label="Book Type"
            />
          </div>

          {aiProvider === "groq" && (
            <Select
              value={groqTextModel}
              onChange={(event) => setGroqTextModel(event.target.value)}
              options={GROQ_TEXT_MODELS}
              icon={Bot}
              label="Groq Text Model"
            />
          )}

          {aiProvider === "gemini" && (
            <label className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 cursor-pointer">
              <span className="flex items-start gap-3 min-w-0">
                <span className="size-9 rounded-lg bg-white text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                  <Search className="size-4" />
                </span>

                <span className="min-w-0">
                  <span className="block text-blue-950 text-sm font-semibold">
                    Ground Gemini with Google Search
                  </span>
                  <span className="block text-blue-700 text-xs mt-1">
                    Use live web search for Gemini outline and chapter writing.
                  </span>
                </span>
              </span>

              <input
                type="checkbox"
                checked={useGoogleSearch}
                onChange={(event) => setUseGoogleSearch(event.target.checked)}
                className="sr-only"
              />

              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  useGoogleSearch ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                    useGoogleSearch ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>
          )}

          <Input
            type="text"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            icon={Users}
            label="Audience"
            placeholder="General readers, founders, beginners..."
          />

          <label className="flex items-center justify-between gap-4 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 cursor-pointer">
            <span className="flex items-start gap-3 min-w-0">
              <span className="size-9 rounded-lg bg-white text-violet-700 flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block text-violet-950 text-sm font-semibold">
                  Generate cover on creation
                </span>
                <span className="block text-violet-700 text-xs mt-1">
                  Creates a durable ebook cover before opening the new book.
                </span>
              </span>
            </span>

            <input
              type="checkbox"
              checked={generateCover}
              onChange={(event) => setGenerateCover(event.target.checked)}
              className="sr-only"
            />

            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                generateCover ? "bg-violet-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  generateCover ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
            <span className="flex items-start gap-3 min-w-0">
              <span className="size-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <ImageIcon className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block text-slate-900 text-sm font-semibold">
                  Add chapter images
                </span>
                <span className="block text-slate-500 text-xs mt-1">
                  When generating the full book, Bookify will create one
                  relevant inline image per chapter.
                </span>
              </span>
            </span>

            <input
              type="checkbox"
              checked={includeImages}
              onChange={(event) => setIncludeImages(event.target.checked)}
              className="sr-only"
            />

            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                includeImages ? "bg-violet-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  includeImages ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </label>

          {includeImages && (
            <section className="rounded-2xl border border-slate-200 bg-slate-950 text-white overflow-hidden">
              <div className="p-4 md:p-5 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.35),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,1))]">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">
                      Visual Bible
                    </p>
                    <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                      Optional. Upload or store image links for recurring
                      characters, style, and locations. Bookify uses them as
                      image inputs, then still uses the first chapter image for
                      overall art continuity.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-200 shrink-0">
                    <input
                      type="checkbox"
                      checked={visualBible.matchBookStyle !== false}
                      onChange={(event) =>
                        setVisualBible((current) => ({
                          ...current,
                          matchBookStyle: event.target.checked,
                        }))
                      }
                      className="size-4 accent-violet-500"
                    />
                    Match generated book style
                  </label>
                </div>
              </div>

              <div className="p-4 md:p-5 space-y-5 bg-slate-50 text-slate-900">
                {VISUAL_REFERENCE_SECTIONS.map((section) => (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {section.label}
                      </h4>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={() => addVisualReference(section.key)}
                      >
                        {section.addLabel}
                      </Button>
                    </div>

                    {(visualBible[section.key] || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-xs text-slate-500">
                        No {section.label.toLowerCase()} references yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {(visualBible[section.key] || []).map(
                          (reference, index) => {
                            const uploadKey = `${section.key}-${reference.id || index}`;
                            const isUploadingReference =
                              uploadingReferenceId === uploadKey;

                            return (
                              <div
                                key={reference.id || index}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                              >
                                <div className="grid grid-cols-1 lg:grid-cols-[7rem,1fr] gap-3">
                                  <div className="h-28 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                    {reference.imageUrl ? (
                                      <img
                                        src={reference.imageUrl}
                                        alt={reference.name || reference.label || "Reference"}
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <ImageIcon className="size-6 text-slate-400" />
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 gap-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        value={reference.name || reference.label || ""}
                                        onChange={(event) =>
                                          updateVisualReference(
                                            section.key,
                                            index,
                                            "name",
                                            event.target.value
                                          )
                                        }
                                        placeholder={section.nameLabel}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                      />

                                      <div className="flex gap-2">
                                        <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100">
                                          <UploadCloud className="size-4" />
                                          Upload
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => {
                                              uploadVisualReferenceFile(
                                                section.key,
                                                index,
                                                event.target.files?.[0]
                                              );
                                              event.target.value = "";
                                            }}
                                          />
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeVisualReference(
                                              section.key,
                                              index
                                            )
                                          }
                                          className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
                                          aria-label="Remove reference"
                                          title="Remove reference"
                                        >
                                          <Trash2 className="size-4" />
                                        </button>
                                      </div>
                                    </div>

                                    <textarea
                                      value={reference.description || ""}
                                      onChange={(event) =>
                                        updateVisualReference(
                                          section.key,
                                          index,
                                          "description",
                                          event.target.value
                                        )
                                      }
                                      rows={2}
                                      maxLength={600}
                                      placeholder={section.descriptionLabel}
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2">
                                      <input
                                        type="url"
                                        value={reference.sourceUrl || ""}
                                        onChange={(event) =>
                                          updateVisualReference(
                                            section.key,
                                            index,
                                            "sourceUrl",
                                            event.target.value
                                          )
                                        }
                                        placeholder="Paste image URL to store on PixioMedia"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                                      />

                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        icon={Link}
                                        isLoading={isUploadingReference}
                                        onClick={() =>
                                          importVisualReferenceUrl(
                                            section.key,
                                            index
                                          )
                                        }
                                      >
                                        Store link
                                      </Button>
                                    </div>

                                    {reference.imageUrl && (
                                      <p className="truncate text-[11px] text-emerald-700">
                                        Stored: {reference.imageUrl}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
            <span className="flex items-start gap-3 min-w-0">
              <span className="size-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Palette className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block text-slate-900 text-sm font-semibold">
                  Include text graphics
                </span>
                <span className="block text-slate-500 text-xs mt-1">
                  Allows charts, diagrams, and visual explainers in the written
                  chapters. Off means the AI is prompted for no graphs.
                </span>
              </span>
            </span>

            <input
              type="checkbox"
              checked={includeTextGraphics}
              onChange={(event) => setIncludeTextGraphics(event.target.checked)}
              className="sr-only"
            />

            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                includeTextGraphics ? "bg-violet-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  includeTextGraphics ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </label>

          {/* Action button */}
          <div className="pt-3 md:pt-4 flex justify-end">
            <Button
              type="button"
              onClick={handleGenerateOutline}
              isLoading={isGeneratingOutline}
              icon={Sparkles}
            >
              Generate Outline with AI
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 md:space-y-5">
          {/* Progress indicator */}
          <ol className="mb-4 md:mb-6 flex items-center gap-2">
            <li
              aria-label="Step 1 completed"
              className="size-7 md:size-8 bg-violet-100 text-violet-600 text-xs md:text-sm font-semibold rounded-full flex justify-center items-center"
            >
              &#10003;
            </li>

            <div className="flex-1 h-0.5 bg-violet-600" />

            <li
              aria-label="Step 2"
              className="size-7 md:size-8 bg-violet-100 text-violet-600 text-xs md:text-sm font-semibold rounded-full flex justify-center items-center"
            >
              2
            </li>
          </ol>

          {/* Chapter review header */}
          <section className="mb-3 md:mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-gray-900 text-base md:text-lg font-semibold">
                Review Chapters
              </h3>
              <p className="text-gray-500 text-xs md:text-sm mt-1">
                Confirm the title, subtitle, and chapter plan before creating
                the book.
              </p>
            </div>

            <span className="text-gray-500 text-xs md:text-sm">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </span>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Input
              type="text"
              value={bookTitle}
              onChange={(event) => setBookTitle(event.target.value)}
              icon={BookOpen}
              label="Book Title"
              required
            />
            <Input
              type="text"
              value={bookSubtitle}
              onChange={(event) => setBookSubtitle(event.target.value)}
              icon={FileText}
              label="Subtitle"
              placeholder="Optional subtitle"
            />
          </section>

          {isGeminiSearchGrounded && (
            <section className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-3">
              <div className="size-9 rounded-lg bg-white text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                <Search className="size-4" />
              </div>

              <div className="min-w-0">
                <p className="text-blue-950 text-sm font-semibold">
                  Search grounding on
                </p>
                <p className="text-blue-700 text-xs mt-1 leading-relaxed">
                  Gemini will use Google Search when writing the full chapters.
                </p>
              </div>
            </section>
          )}

          {includeImages && hasVisualBibleContent(visualBible) && (
            <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="size-9 rounded-lg bg-white text-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                <ImageIcon className="size-4" />
              </div>

              <div className="min-w-0">
                <p className="text-slate-950 text-sm font-semibold">
                  Visual Bible active
                </p>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                  Chapter images will use your character, style, and world
                  references before matching generated chapter art.
                </p>
              </div>
            </section>
          )}

          {outlineStats && (
            <section className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">
                  Speed
                </p>
                <p className="text-slate-900 text-sm font-semibold">
                  {Number(outlineStats.outputTokensPerSecond || 0).toFixed(1)}{" "}
                  T/s
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">
                  Time
                </p>
                <p className="text-slate-900 text-sm font-semibold">
                  {Number(outlineStats.totalTime || 0).toFixed(2)}s
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase text-slate-400 font-semibold">
                  Tokens
                </p>
                <p className="text-slate-900 text-sm font-semibold">
                  {outlineStats.totalTokens || 0}
                </p>
              </div>
            </section>
          )}

          {generationJob && (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-emerald-950 text-sm font-semibold capitalize">
                    {generationJob.status}
                  </p>
                  <p className="text-emerald-800 text-xs">
                    {generationJob.progress?.message || "Generating"}
                  </p>
                </div>

                {isGeneratingFullBook && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelGeneration}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
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
            </section>
          )}

          {/* Chapters list */}
          <div
            ref={chaptersContainerRef}
            className="space-y-3 max-h-[min(20rem,34dvh)] md:max-h-[min(24rem,38dvh)] overflow-y-auto pr-1"
          >
            {chapters.length === 0 ? (
              <div className="bg-gray-50 text-center rounded-xl px-4 py-10 md:py-12">
                <BookOpen className="size-10 md:size-12 text-gray-300 mx-auto mb-3" />

                <p className="text-gray-500 text-xs md:text-sm">
                  No chapters yet! Add one to start...
                </p>
              </div>
            ) : (
              chapters.map(({ title, description }, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-sm focus-within:border-gray-300 focus-within:shadow-sm group"
                >
                  <div className="mb-2 md:mb-3 flex items-start gap-2 md:gap-3">
                    <div className="shrink-0 size-5 md:size-6 bg-violet-50 text-violet-600 text-xs font-semibold rounded-full mt-1 flex justify-center items-center">
                      {index + 1}
                    </div>

                    {/* Chapter title input */}
                    <input
                      type="text"
                      value={title}
                      onChange={(event) =>
                        handleEditChapter(index, "title", event.target.value)
                      }
                      placeholder="Chapter Title"
                      className="flex-1 bg-transparent text-gray-900 text-sm md:text-base font-medium border-none focus:outline-none focus:ring-0 p-0"
                    />

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteChapter(index)}
                      aria-label="Delete chapter"
                      title="Delete chapter"
                      disabled={chapters.length === 1}
                      className="opacity-0 rounded-lg p-1 md:p-1.5 transition-all duration-200 disabled:opacity-0 disabled:cursor-not-allowed group-hover:opacity-100 group-hover:bg-red-50 group-focus-within:opacity-100 group-focus-within:bg-red-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <Trash2 className="size-3.5 md:size-4 text-red-500" />
                    </button>
                  </div>

                  {/* Chapter description textarea */}
                  <textarea
                    value={description}
                    onChange={(event) =>
                      handleEditChapter(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                    rows={2}
                    placeholder="Brief description of what this chapter covers..."
                    className="w-full bg-transparent text-gray-600 text-xs md:text-sm placeholder-gray-400 border-none resize-none focus:outline-none focus:ring-0 p-0"
                  />
                </div>
              ))
            )}
          </div>

          <section className="border-t border-gray-100 pt-4 md:pt-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white flex flex-col gap-4 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-slate-900 text-sm font-semibold">
                      Start with an outline draft
                    </h4>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                      Saves the chapter plan so you can edit structure before
                      writing chapter content.
                    </p>
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 cursor-pointer">
                  <span className="text-slate-800 text-sm font-medium">
                    Generate cover
                  </span>
                  <input
                    type="checkbox"
                    checked={generateCover}
                    onChange={(event) => setGenerateCover(event.target.checked)}
                    className="size-4 accent-violet-600"
                  />
                </label>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFinaliseBook}
                  isLoading={isFinalisingBook}
                  className="w-full"
                >
                  Create Outline Draft
                </Button>
              </div>

              <div className="border border-violet-200 rounded-xl p-4 md:p-5 bg-violet-50/60 flex flex-col gap-4 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-white text-violet-700 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="size-4" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-violet-950 text-sm font-semibold">
                      Generate the full book now
                    </h4>
                    <p className="text-violet-700 text-xs mt-1 leading-relaxed">
                      Fills every chapter with the selected provider and tracks
                      progress while it runs.
                    </p>
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-white/70 border border-violet-100 px-3 py-2 cursor-pointer">
                  <span className="text-violet-950 text-sm font-medium">
                    Generate cover
                  </span>
                  <input
                    type="checkbox"
                    checked={generateCover}
                    onChange={(event) => setGenerateCover(event.target.checked)}
                    className="size-4 accent-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-white/70 border border-violet-100 px-3 py-2 cursor-pointer">
                  <span className="text-violet-950 text-sm font-medium">
                    Include chapter images
                  </span>
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={(event) => setIncludeImages(event.target.checked)}
                    className="size-4 accent-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-white/70 border border-violet-100 px-3 py-2 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block text-violet-950 text-sm font-medium">
                      Include text graphics
                    </span>
                    <span className="block text-violet-700 text-[11px] leading-relaxed">
                      Allows charts, diagrams, and visual explainers in chapter text.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeTextGraphics}
                    onChange={(event) =>
                      setIncludeTextGraphics(event.target.checked)
                    }
                    className="size-4 shrink-0 accent-violet-600"
                  />
                </label>

                <div className="rounded-lg bg-white/70 border border-violet-100 px-3 py-3">
                  <Select
                    name="stepTwoChapterLength"
                    value={chapterLength}
                    onChange={(event) => setChapterLength(event.target.value)}
                    options={CHAPTER_LENGTH_OPTIONS}
                    label="Chapter length"
                  />
                  <p className="text-violet-700 text-[11px] leading-relaxed mt-2">
                    Large asks for the most detailed, page-rich chapters.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleGenerateFullBook}
                  isLoading={isGeneratingFullBook}
                  icon={Sparkles}
                  className="w-full"
                >
                  Generate Full Book
                </Button>
              </div>
            </div>
          </section>

          {/* Action buttons */}
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              icon={ArrowLeft}
              ariaLabel="Go back to step 1"
            >
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleAddChapter}
                icon={Plus}
                disabled={chapters.length >= 26}
              >
                Add Chapter
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CreateBookModal;
