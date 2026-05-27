import {
  Bot,
  ChevronDown,
  Eye,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Sparkles,
  TypeOutline,
} from "lucide-react";
import { useMemo, useState } from "react";
import Button from "../ui/Button";
import Dropdown, { DropdownItem } from "../ui/Dropdown";
import Input from "../ui/Input";
import Select from "../ui/Select";
import SimpleMDEditor from "./SimpleMDEditor";
import MarkdownPreview from "./MarkdownPreview";

function ChapterEditorTab({
  book = {
    title: "Untitled",
    chapters: [
      {
        title: "Chapter 1",
        content: "_",
      },
    ],
  },
  selectedChapterIndex = 0,
  onEditChapter = () => {},
  isGenerating,
  onGeneratingChapterContent = () => {},
  isGeneratingImage = false,
  onGenerateChapterImage = () => {},
  onGenerateInlineImageCommand = () => {},
}) {
  const [isInPreviewMode, setIsInPreviewMode] = useState(false);
  const [isInFullScreenMode, setIsInFullScreenMode] = useState(false);
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imagePromptChapterIndex, setImagePromptChapterIndex] = useState(null);
  const [imageAspectRatio, setImageAspectRatio] = useState("16:9");
  const [imageSize, setImageSize] = useState("1K");
  const [imageModel, setImageModel] = useState(
    "gemini-3.1-flash-image-preview"
  );
  const [visualReferenceSelection, setVisualReferenceSelection] = useState({
    chapterIndex: null,
    ids: null,
  });

  const mdEditorOptions = useMemo(
    () => ({
      autoFocus: true,
      spellCheck: false,
    }),
    []
  );
  const hasSelectedChapter =
    selectedChapterIndex !== null &&
    book &&
    Array.isArray(book.chapters) &&
    Boolean(book.chapters[selectedChapterIndex]);
  const currentChapter = hasSelectedChapter ? book.chapters[selectedChapterIndex] : {};
  const visualCharacters = Array.isArray(book?.visualBible?.characters)
    ? book.visualBible.characters.filter((reference) => reference.imageUrl)
    : [];
  const chapterReferenceText = [
    currentChapter.title,
    currentChapter.description,
    currentChapter.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const suggestedVisualReferenceIds = visualCharacters
    .filter((reference) => {
      const name = String(reference.name || reference.label || "")
        .trim()
        .toLowerCase();

      return name && chapterReferenceText.includes(name);
    })
    .map((reference) => reference.id);
  const allVisualReferenceIds = visualCharacters.map((reference) => reference.id);
  const activeSelectedVisualReferenceIds =
    visualReferenceSelection.chapterIndex === selectedChapterIndex &&
    Array.isArray(visualReferenceSelection.ids)
      ? visualReferenceSelection.ids
      : allVisualReferenceIds;
  const explicitVisualReferenceIds =
    visualReferenceSelection.chapterIndex === selectedChapterIndex
      ? activeSelectedVisualReferenceIds
      : undefined;

  if (!hasSelectedChapter) {
    return (
      <section className="flex-1 flex justify-center items-center p-8">
        <div className="text-center">
          <div className="size-16 bg-slate-100 rounded-full mx-auto mb-4 flex justify-center items-center">
            <TypeOutline className="size-8 text-slate-400" />
          </div>

          <h2 className="text-slate-700 text-lg font-semibold mb-2">
            Select a chapter to start editing
          </h2>

          <p className="text-slate-400 text-sm">
            Choose from the sidebar to begin writing
          </p>
        </div>
      </section>
    );
  }

  const chapterActionLabel = currentChapter.content?.trim()
    ? "Regenerate"
    : "Generate";

  const buildSuggestedImagePrompt = () => {
    const contentExcerpt = (currentChapter.content || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/[#>*_`~|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 700);

    return [
      `Create a relevant inline ebook illustration for "${currentChapter.title || `Chapter ${selectedChapterIndex + 1}`}" in "${book.title}".`,
      `Genre: ${book.genre || "Nonfiction"}.`,
      `Audience: ${book.audience || "General readers"}.`,
      currentChapter.description
        ? `Chapter brief: ${currentChapter.description}.`
        : "",
      contentExcerpt ? `Use this chapter excerpt for context: ${contentExcerpt}` : "",
      "No text, captions, logos, or UI inside the image. Make it clear, polished, and useful inside the current chapter.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleImagePanelToggle = () => {
    const shouldOpen = !isImagePanelOpen;

    if (
      shouldOpen &&
      (!imagePrompt.trim() || imagePromptChapterIndex !== selectedChapterIndex)
    ) {
      setImagePrompt(buildSuggestedImagePrompt());
      setImagePromptChapterIndex(selectedChapterIndex);
    }

    setIsImagePanelOpen(shouldOpen);
  };

  const handleGenerateImage = async (event) => {
    event.preventDefault();

    await onGenerateChapterImage(selectedChapterIndex, {
      prompt: imagePrompt,
      aspectRatio: imageAspectRatio,
      imageSize,
      model: imageModel,
      visualReferenceIds: explicitVisualReferenceIds,
    });
  };

  const handleGenerateInlineImageCommand = async (command) => {
    await onGenerateInlineImageCommand(selectedChapterIndex, {
      ...command,
      aspectRatio: imageAspectRatio,
      imageSize,
      model: imageModel,
    });
  };

  return (
    <article
      className={`${
        isInFullScreenMode ? "bg-white fixed inset-0 z-50" : "flex-1"
      } flex flex-col`}
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-slate-900 text-lg sm:text-xl lg:text-2xl font-bold truncate">
                Editor
              </h1>

              <p className="max-w-[300px] sm:max-w-full text-slate-500 text-sm sm:text-base mt-1 truncate">
                Editing:{" "}
                <span
                  title={
                    currentChapter.title ||
                    `Chapter ${selectedChapterIndex + 1}`
                  }
                  className="text-slate-700 font-medium"
                >
                  {currentChapter.title ||
                    `Chapter ${selectedChapterIndex + 1}`}
                </span>
              </p>
            </div>

            {/* Editor controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <nav className="border border-slate-200 rounded-lg overflow-hidden flex items-center shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsInPreviewMode(false)}
                  className={`text-xs sm:text-sm font-medium px-3 py-2 transition-all duration-150 ${
                    !isInPreviewMode
                      ? "bg-violet-50 text-violet-700 border-r border-violet-200"
                      : "text-slate-600 hover:bg-slate-50 focus-visible:bg-slate-50"
                  }`}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => setIsInPreviewMode(true)}
                  className={`text-xs sm:text-sm font-semibold px-3 py-2 transition-all duration-150 ${
                    isInPreviewMode
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 focus-visible:bg-slate-50"
                  }`}
                >
                  Preview
                </button>
              </nav>

              <button
                type="button"
                onClick={() => setIsInFullScreenMode(!isInFullScreenMode)}
                aria-label={
                  isInFullScreenMode ? "Exit full screen" : "Full screen"
                }
                title={isInFullScreenMode ? "Exit Full Screen" : "Full Screen"}
                className="text-slate-600 rounded-lg p-2 transition-all duration-150 hover:bg-slate-100 focus-visible:bg-slate-100 border border-slate-200 shadow-sm"
              >
                {isInFullScreenMode ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </button>

              <Button
                type="button"
                variant="secondary"
                icon={ImageIcon}
                size="sm"
                isLoading={isGeneratingImage}
                onClick={handleImagePanelToggle}
                className="shadow-sm"
              >
                <span className="hidden sm:inline">Images</span>
              </Button>

              <Dropdown
                trigger={
                  <Button
                    type="button"
                    isLoading={isGenerating}
                    icon={Sparkles}
                    size="sm"
                    className="shadow-sm"
                  >
                    <span className="hidden sm:inline-flex items-center gap-1">
                      {chapterActionLabel} Chapter
                      <ChevronDown className="size-4" />
                    </span>

                    <span className="sm:hidden inline-flex items-center">
                      <ChevronDown className="size-4" />
                    </span>
                  </Button>
                }
              >
                <DropdownItem
                  disabled={isGenerating}
                  onClick={() =>
                    onGeneratingChapterContent(selectedChapterIndex, "gemini")
                  }
                >
                  <Bot className="text-slate-500 size-4" />
                  {chapterActionLabel} with Gemini
                </DropdownItem>

                <DropdownItem
                  disabled={isGenerating}
                  onClick={() =>
                    onGeneratingChapterContent(selectedChapterIndex, "groq")
                  }
                >
                  <Sparkles className="text-slate-500 size-4" />
                  {chapterActionLabel} with Groq
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </div>
      </header>

      {isImagePanelOpen && (
        <section className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4">
          <form
            onSubmit={handleGenerateImage}
            className="grid grid-cols-1 xl:grid-cols-[1fr,10rem,8rem,13rem,auto] gap-3 xl:items-end"
          >
            <div className="grid grid-cols-1 gap-2">
              <label
                htmlFor="chapter-image-prompt"
                className="text-slate-700 text-sm font-medium"
              >
                Chapter Image
              </label>
              <textarea
                id="chapter-image-prompt"
                name="chapter-image-prompt"
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                rows={3}
                maxLength={1200}
                placeholder="Optional scene, style, palette, camera angle..."
                className="w-full min-h-24 xl:min-h-11 bg-white text-gray-900 text-sm placeholder-gray-400 px-3 py-2 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 resize-none"
              />

              {visualCharacters.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Character inputs
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVisualReferenceSelection({
                            chapterIndex: selectedChapterIndex,
                            ids: allVisualReferenceIds,
                          })
                        }
                        className="text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVisualReferenceSelection({
                            chapterIndex: selectedChapterIndex,
                            ids: suggestedVisualReferenceIds,
                          })
                        }
                        className="text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                      >
                        Mentioned
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {visualCharacters.map((reference) => {
                      const checked = activeSelectedVisualReferenceIds.includes(
                        reference.id
                      );

                      return (
                        <label
                          key={reference.id}
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs cursor-pointer ${
                            checked
                              ? "border-violet-300 bg-violet-50 text-violet-800"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? Array.from(
                                    new Set([
                                      ...activeSelectedVisualReferenceIds,
                                      reference.id,
                                    ])
                                  )
                                : activeSelectedVisualReferenceIds.filter(
                                    (id) => id !== reference.id
                                  );

                              setVisualReferenceSelection({
                                chapterIndex: selectedChapterIndex,
                                ids: nextIds,
                              });
                            }}
                            className="size-3 accent-violet-600"
                          />
                          {reference.name || reference.label || "Character"}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Select
              label="Shape"
              name="chapterImageAspectRatio"
              value={imageAspectRatio}
              onChange={(event) => setImageAspectRatio(event.target.value)}
              options={[
                { label: "Wide", value: "16:9" },
                { label: "Classic", value: "4:3" },
                { label: "Landscape", value: "3:2" },
                { label: "Square", value: "1:1" },
                { label: "Portrait", value: "2:3" },
              ]}
            />

            <Select
              label="Size"
              name="chapterImageSize"
              value={imageSize}
              onChange={(event) => setImageSize(event.target.value)}
              options={[
                { label: "1K", value: "1K" },
                { label: "2K", value: "2K" },
                { label: "4K", value: "4K" },
              ]}
            />

            <Select
              label="Model"
              name="chapterImageModel"
              value={imageModel}
              onChange={(event) => setImageModel(event.target.value)}
              options={[
                {
                  label: "Nano Banana 2",
                  value: "gemini-3.1-flash-image-preview",
                },
                {
                  label: "Nano Banana Pro",
                  value: "gemini-3-pro-image-preview",
                },
                {
                  label: "Nano Banana",
                  value: "gemini-2.5-flash-image",
                },
              ]}
            />

            <Button
              type="submit"
              icon={Sparkles}
              isLoading={isGeneratingImage}
              disabled={isGenerating}
              size="sm"
              className="w-full xl:w-fit"
            >
              Insert Image
            </Button>
          </form>
        </section>
      )}

      {/* Content area */}
      <section className="flex-1 overflow-hidden">
        <div className="h-full bg-white px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="h-full bg-white">
            <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
              {/* Chapter title input */}
              <div>
                <Input
                  label="Chapter Title"
                  name="title"
                  value={currentChapter.title || ""}
                  onChange={(e) => onEditChapter("title", e.target.value)}
                  placeholder="Enter chapter title..."
                  className="text-lg sm:text-xl font-semibold"
                />
              </div>

              {/* Editor/preview area */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {isInPreviewMode ? (
                  <div className="h-full border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
                      <div className="text-slate-600 text-sm flex items-center gap-2">
                        <Eye className="size-4" />
                        <span className="font-medium">Preview Mode</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                      <MarkdownPreview
                        source={currentChapter.content}
                        emptyMessage="No content yet. Start typing to see preview here."
                        style={{
                          fontFamily:
                            "Charter, Georgia, 'Times New Roman', serif",
                          lineHeight: 1.7,
                        }}
                        className="formatted-content prose prose-slate max-w-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full">
                    <SimpleMDEditor
                      value={currentChapter.content || ""}
                      onChange={(value) => onEditChapter("content", value)}
                      options={mdEditorOptions}
                      isGeneratingImageCommand={isGeneratingImage}
                      onGenerateImageCommand={handleGenerateInlineImageCommand}
                    />
                  </div>
                )}
              </div>

              {/* Status bar */}
              <footer className="text-slate-500 text-xs sm:text-sm border-t border-slate-100 pt-3 sm:pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-slate-600">Words:</span>
                    <span className="text-slate-900 font-semibold">
                      {currentChapter.content
                        ? currentChapter.content
                            .split(/\s+/)
                            .filter((word) => word.length > 0).length
                        : 0}
                    </span>
                  </span>

                  <span className="flex items-center gap-1">
                    <span className="font-medium text-slate-600">
                      Characters:
                    </span>
                    <span className="text-slate-900 font-semibold">
                      {currentChapter.content
                        ? currentChapter.content.length
                        : 0}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-slate-600 font-medium">Auto-saved</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

export default ChapterEditorTab;
