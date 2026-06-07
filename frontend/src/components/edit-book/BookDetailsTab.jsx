import { useState } from "react";
import {
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { resolveImageUrl } from "../../utils/api-endpoints";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

function BookDetailsTab({
  book,
  onEditBook,
  fileInputRef,
  isUploading,
  onCoverImageUpload,
  isGeneratingCover = false,
  onGenerateCoverImage = () => {},
}) {
  const [isCoverMakerOpen, setIsCoverMakerOpen] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverAspectRatio, setCoverAspectRatio] = useState("2:3");
  const [coverImageSize, setCoverImageSize] = useState("1K");
  const [coverModel, setCoverModel] = useState("gemini-3.1-flash-image-preview");
  const [coverMode, setCoverMode] = useState("generate");
  const coverImageUrl = book.coverImage ? resolveImageUrl(book.coverImage) : null;
  const generationStats = book.generation?.stats;
  const generatedCover = book.coverGeneration?.source === "gemini";
  const canEditGeneratedCover = generatedCover && Boolean(coverImageUrl);
  const effectiveCoverMode =
    canEditGeneratedCover && coverMode === "edit" ? "edit" : "generate";

  const handleCoverGeneration = async (event) => {
    event.preventDefault();

    await onGenerateCoverImage({
      prompt: coverPrompt,
      aspectRatio: coverAspectRatio,
      imageSize: coverImageSize,
      model: coverModel,
      mode: effectiveCoverMode,
    });
  };

  const openCoverMaker = () => {
    setIsCoverMakerOpen((current) => !current);

    if (!isCoverMakerOpen) {
      setCoverMode(canEditGeneratedCover ? "edit" : "generate");

      if (book.coverGeneration?.aspectRatio) {
        setCoverAspectRatio(book.coverGeneration.aspectRatio);
      }

      if (book.coverGeneration?.imageSize) {
        setCoverImageSize(book.coverGeneration.imageSize);
      }

      if (book.coverGeneration?.model) {
        setCoverModel(book.coverGeneration.model);
      }
    }
  };

  return (
    <div className="max-w-4xl p-4 sm:p-6 lg:p-8 mx-auto">
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-slate-900 text-base sm:text-lg font-semibold mb-4">
          Book Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Input
            type="text"
            label="Title"
            name="title"
            value={book.title}
            onChange={onEditBook}
          />

          <Input
            type="text"
            label="Author"
            name="author"
            value={book.author}
            onChange={onEditBook}
          />

          <div className="md:col-span-2">
            <Input
              type="text"
              label="Subtitle"
              name="subtitle"
              value={book.subtitle || ""}
              onChange={onEditBook}
            />
          </div>

          <Input
            type="text"
            label="Book Type"
            name="genre"
            value={book.genre || "Nonfiction"}
            onChange={onEditBook}
          />

          <Input
            type="text"
            label="Audience"
            name="audience"
            value={book.audience || "General readers"}
            onChange={onEditBook}
          />
        </div>
      </section>

      {book.generation?.provider && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 mt-6 sm:mt-8 shadow-sm">
          <h3 className="text-slate-900 text-base sm:text-lg font-semibold mb-4">
            AI Generation
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] uppercase text-slate-400 font-semibold">
                Provider
              </p>
              <p className="text-slate-900 text-sm font-semibold capitalize">
                {book.generation.provider}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] uppercase text-slate-400 font-semibold">
                Status
              </p>
              <p className="text-slate-900 text-sm font-semibold capitalize">
                {book.generation.status || "manual"}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] uppercase text-slate-400 font-semibold">
                Speed
              </p>
              <p className="text-slate-900 text-sm font-semibold">
                {Number(generationStats?.outputTokensPerSecond || 0).toFixed(1)}{" "}
                T/s
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] uppercase text-slate-400 font-semibold">
                Tokens
              </p>
              <p className="text-slate-900 text-sm font-semibold">
                {generationStats?.totalTokens || 0}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Structure:</span>{" "}
              {book.generation.structureModel || "Not recorded"}
            </p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-800">Chapters:</span>{" "}
              {book.generation.sectionModel || "Not recorded"}
            </p>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 mt-6 sm:mt-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="text-slate-900 text-base sm:text-lg font-semibold">
            Cover Image
          </h3>

          {generatedCover && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 w-fit">
              Gemini cover
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[10rem,1fr] gap-4 sm:gap-6 items-start">
          {/* Cover image display with empty state */}
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Cover image"
              className="w-full max-w-44 lg:max-w-none h-64 lg:h-56 bg-slate-100 object-cover rounded-lg shadow-sm"
            />
          ) : (
            <div className="w-full max-w-44 lg:max-w-none h-64 lg:h-56 bg-linear-to-br from-violet-50 to-purple-50 border-2 border-dashed border-violet-200 rounded-lg shadow-sm flex flex-col items-center justify-center gap-2 p-4">
              <div className="size-12 bg-violet-100 rounded-full flex items-center justify-center">
                <ImageIcon className="size-6 text-violet-600" />
              </div>
              <p className="text-xs text-center text-slate-500 font-medium">
                No cover image
              </p>
            </div>
          )}

          <div className="w-full grid grid-cols-1 gap-5">
            {/* Upload section */}
            <div className="flex flex-col gap-y-3 sm:gap-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="cover-image"
                  className="text-slate-700 text-xs sm:text-sm font-medium block"
                >
                  Upload Cover Image
                </label>
                <p className="text-slate-500 text-xs">
                  Recommended size: 600x800px (max 2MB)
                </p>
              </div>

              <input
                type="file"
                name="coverImage"
                id="cover-image"
                ref={fileInputRef}
                onChange={onCoverImageUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef?.current?.click()}
                  isLoading={isUploading}
                  icon={UploadCloud}
                  size="sm"
                  className="w-full sm:w-fit"
                >
                  {coverImageUrl ? "Change Image" : "Upload Image"}
                </Button>

                <Button
                  type="button"
                  onClick={openCoverMaker}
                  isLoading={isGeneratingCover}
                  icon={generatedCover ? Pencil : Sparkles}
                  size="sm"
                  className="w-full sm:w-fit"
                >
                  {generatedCover ? "Edit / Regenerate Cover" : "Generate Cover"}
                </Button>
              </div>
            </div>

            {isCoverMakerOpen && (
              <form
                onSubmit={handleCoverGeneration}
                className="border-t border-slate-100 pt-5 grid grid-cols-1 gap-4"
              >
              {canEditGeneratedCover && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCoverMode("edit")}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                      effectiveCoverMode === "edit"
                        ? "border-violet-300 bg-violet-50 text-violet-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Pencil className="size-4 shrink-0" />
                    <span className="text-sm font-semibold">
                      Edit current cover
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCoverMode("generate")}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                      effectiveCoverMode === "generate"
                        ? "border-violet-300 bg-violet-50 text-violet-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <RefreshCw className="size-4 shrink-0" />
                    <span className="text-sm font-semibold">
                      Regenerate fresh
                    </span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <label
                  htmlFor="cover-prompt"
                  className="text-slate-700 text-sm font-medium"
                >
                  {effectiveCoverMode === "edit"
                    ? "Edit Instructions"
                    : "Cover Maker"}
                </label>
                <textarea
                  id="cover-prompt"
                  name="cover-prompt"
                  value={coverPrompt}
                  onChange={(event) => setCoverPrompt(event.target.value)}
                  rows={4}
                  maxLength={1200}
                  placeholder={
                    effectiveCoverMode === "edit"
                      ? "Tell Gemini what to change while keeping the current cover concept..."
                      : "Optional direction, mood, scene, typography, colors..."
                  }
                  className="w-full bg-white text-gray-900 text-sm placeholder-gray-400 px-3 py-2 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="Shape"
                  name="coverAspectRatio"
                  value={coverAspectRatio}
                  onChange={(event) => setCoverAspectRatio(event.target.value)}
                  options={[
                    { label: "Book cover", value: "2:3" },
                    { label: "Tall cover", value: "3:4" },
                    { label: "Square", value: "1:1" },
                    { label: "Wide banner", value: "16:9" },
                  ]}
                />

                <Select
                  label="Size"
                  name="coverImageSize"
                  value={coverImageSize}
                  onChange={(event) => setCoverImageSize(event.target.value)}
                  options={[
                    { label: "1K", value: "1K" },
                    { label: "2K", value: "2K" },
                    { label: "4K", value: "4K" },
                  ]}
                />

                <Select
                  label="Model"
                  name="coverModel"
                  value={coverModel}
                  onChange={(event) => setCoverModel(event.target.value)}
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
              </div>

              <Button
                type="submit"
                icon={effectiveCoverMode === "edit" ? Pencil : Sparkles}
                isLoading={isGeneratingCover}
                size="sm"
                className="w-full sm:w-fit"
              >
                {effectiveCoverMode === "edit"
                  ? "Edit Current Cover"
                  : generatedCover
                    ? "Regenerate Cover"
                    : "Create Cover"}
              </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default BookDetailsTab;
