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
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Select from "./ui/Select";
import { AI_PROVIDERS, BOOK_GENRES, WRITING_STYLES } from "../utils/constants";
import Button from "./ui/Button";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

function CreateBookModal({ isOpen, onClose, onBookCreate }) {
  const [step, setStep] = useState(1);
  const [bookTitle, setBookTitle] = useState("");
  const [chapterCount, setChapterCount] = useState(5);
  const [chapters, setChapters] = useState([]);
  const [topic, setTopic] = useState("");
  const [writingStyle, setWritingStyle] = useState(WRITING_STYLES[0]);
  const [aiProvider, setAiProvider] = useState("groq");
  const [bookGenre, setBookGenre] = useState(BOOK_GENRES[0]);
  const [audience, setAudience] = useState("General readers");
  const [generateCover, setGenerateCover] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
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
    setChapterCount(5);
    setChapters([]);
    setTopic("");
    setWritingStyle(WRITING_STYLES[0]);
    setAiProvider("groq");
    setBookGenre(BOOK_GENRES[0]);
    setAudience("General readers");
    setGenerateCover(true);
    setIncludeImages(false);
    setGenerationStats(null);
    setGenerationJob(null);
    setIsGeneratingOutline(false);
    setIsGeneratingFullBook(false);
    setIsFinalisingBook(false);
  };

  const handleGenerateOutline = async () => {
    const validChapterCount =
      typeof chapterCount === "string" ? parseInt(chapterCount) : chapterCount;

    if (!bookTitle || !validChapterCount || validChapterCount < 1) {
      toast.error("Book title and a valid number of chapters are required!", {
        duration: 5000,
      });

      return;
    }

    setIsGeneratingOutline(true);

    try {
      const {
        data: { outline, generation },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_OUTLINE, {
        topic: bookTitle,
        description: topic || "",
        style: writingStyle,
        chapterCount: validChapterCount,
        provider: aiProvider,
        genre: bookGenre,
        audience,
      });
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

  const handleFinaliseBook = async () => {
    if (chapters.length === 0) {
      toast.error("At least one chapter is required!", { duration: 5000 });

      return;
    }

    setIsFinalisingBook(true);

    try {
      const { data } = await axiosInstance.post(API_ENDPOINTS.BOOKS.CREATE, {
        title: bookTitle,
        author: user?.name || "Unknown Author",
        genre: bookGenre,
        audience,
        chapters,
        generation: {
          provider: aiProvider,
          status: "outline",
          style: writingStyle,
          ...(generationStats || {}),
        },
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
          author: user?.name || "Unknown Author",
          topic: bookTitle,
          description: topic || "",
          style: writingStyle,
          chapterCount: chapters.length,
          genre: bookGenre,
          audience,
          outline: chapters,
          provider: aiProvider,
          generateCover,
          includeImages,
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
            type="number"
            value={chapterCount}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "") {
                setChapterCount("");

                return;
              }

              // parse and clamp between 1-20
              const parsed = parseInt(value);

              if (!isNaN(parsed)) {
                setChapterCount(Math.max(1, Math.min(20, parsed)));
              }
            }}
            onBlur={(event) => {
              // ensure we have a valid number
              const value = event.target.value;

              if (value === "" || isNaN(parseInt(value))) {
                setChapterCount(5);
              }
            }}
            icon={Hash}
            label="Number of Chapters"
            min="1"
            max="20"
            step="1"
            placeholder="5"
          />

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
              onChange={(event) => setAiProvider(event.target.value)}
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
          <section className="mb-3 md:mb-4 flex justify-between items-center">
            <h3 className="text-gray-900 text-base md:text-lg font-semibold">
              Review Chapters
            </h3>

            <span className="text-gray-500 text-xs md:text-sm">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </span>
          </section>

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
