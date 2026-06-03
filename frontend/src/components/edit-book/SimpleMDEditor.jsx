import { useState, useEffect } from "react";
import { Lock, Loader2, Sparkles, Trash2, TypeOutline } from "lucide-react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import {
  findMarkdownImageAtSelection,
  removeMarkdownImage,
} from "../../utils/markdown-images";

function findImageCommandAtCursor(content = "", cursorPosition = 0) {
  const safeCursor = Math.max(0, Math.min(cursorPosition, content.length));
  const lineStart = content.lastIndexOf("\n", safeCursor - 1) + 1;
  const nextLineBreak = content.indexOf("\n", safeCursor);
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
  const commandText = content.slice(lineStart, lineEnd);
  const match = commandText.match(
    /^\s*\/generate\s+image(?:\s+of)?\s+(.{2,})\s*$/i
  );

  if (!match) return null;

  return {
    commandText,
    end: lineEnd,
    prompt: match[1].trim(),
    sourceContent: content,
    start: lineStart,
  };
}

function SimpleMDEditor({
  value,
  onChange,
  options,
  isGeneratingImageCommand = false,
  onGenerateImageCommand,
  onRemoveMarkdownImage,
  isLocked = false,
  lockMessage = "AI is updating this chapter.",
}) {
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [imageCommand, setImageCommand] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const { textareaProps: externalTextareaProps = {}, ...editorOptions } =
    options || {};

  const updateEditorContext = (event) => {
    const textarea = event.currentTarget;
    const nextCommand = findImageCommandAtCursor(
      textarea.value,
      textarea.selectionStart
    );
    const nextImage = findMarkdownImageAtSelection(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd
    );

    setImageCommand(nextCommand);
    setActiveImage(nextImage);
  };

  const handleGenerateImageCommand = async () => {
    if (!imageCommand || !onGenerateImageCommand) return;

    await onGenerateImageCommand(imageCommand);
    setImageCommand(null);
  };

  const handleRemoveActiveImage = () => {
    if (!activeImage || isLocked) return;

    if (onRemoveMarkdownImage) {
      onRemoveMarkdownImage(activeImage);
      setActiveImage(null);
      setImageCommand(null);
      return;
    }

    const nextValue = removeMarkdownImage(value || "", activeImage);

    onChange(nextValue);
    setActiveImage(null);
    setImageCommand(null);
  };

  // Listen for screen resize to handle responsive layout logic
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    // initial check
    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // If large screen: Force "live" (side-by-side)
  // If small screen: Toggle between "preview" (full preview) and "edit" (full edit) based on button state
  const editorMode = isLargeScreen ? "live" : "edit";

  const handleEditorChange = (nextValue) => {
    if (isLocked) return;

    const nextContent = nextValue || "";

    onChange(nextContent);

    setImageCommand((currentCommand) => {
      if (!currentCommand) return null;

      return nextContent.slice(currentCommand.start, currentCommand.end) ===
        currentCommand.commandText
        ? currentCommand
        : null;
    });
    setActiveImage((currentImage) => {
      if (!currentImage) return null;

      return nextContent.slice(currentImage.start, currentImage.end) ===
        currentImage.markdown
        ? currentImage
        : null;
    });
  };

  return (
    <div
      className={`border rounded-lg shadow-sm overflow-hidden h-full flex flex-col relative ${
        isLocked ? "border-amber-200" : "border-slate-200"
      }`}
      data-color-mode="light"
    >
      <header className="bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-2.5 shrink-0">
        <div className="text-slate-600 text-xs sm:text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1">
            <TypeOutline className="size-3 sm:size-3.5" />
            <span className="font-medium">Markdown Editor</span>
          </div>

          {activeImage ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="max-w-full sm:max-w-80 truncate text-[11px] sm:text-xs text-rose-700 font-medium">
                {activeImage.alt || activeImage.url || "Markdown image"}
              </span>

              <button
                type="button"
                onClick={handleRemoveActiveImage}
                disabled={isLocked}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </div>
          ) : imageCommand ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="max-w-full sm:max-w-80 truncate text-[11px] sm:text-xs text-violet-700 font-medium">
                {imageCommand.prompt}
              </span>

              <button
                type="button"
                onClick={handleGenerateImageCommand}
                disabled={isGeneratingImageCommand || isLocked}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="size-3.5" />
                {isGeneratingImageCommand ? "Generating" : "Generate"}
              </button>
            </div>
          ) : (
            <span className="text-[10px] sm:text-xs text-slate-400">
              Type /generate image of ... to insert art here
            </span>
          )}
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <MDEditor
          value={value}
          onChange={handleEditorChange}
          height="100%"
          preview={editorMode}
          {...editorOptions}
          previewOptions={{
            rehypePlugins: [[rehypeSanitize]],
          }}
          commands={[
            commands.bold,
            commands.italic,
            commands.strikethrough,
            commands.hr,
            commands.heading,
            commands.divider,
            commands.link,
            commands.code,
            commands.codeBlock,
            commands.image,
            commands.divider,
            commands.unorderedListCommand,
            commands.orderedListCommand,
            commands.checkedListCommand,
          ]}
          textareaProps={{
            ...externalTextareaProps,
            readOnly: isLocked || externalTextareaProps.readOnly,
            "aria-readonly": isLocked || externalTextareaProps["aria-readonly"],
            placeholder:
              "Start writing your chapter content here...\n\nTip: Use ```language to create code blocks with syntax highlighting",
            onClick: (event) => {
              externalTextareaProps.onClick?.(event);
              updateEditorContext(event);
            },
            onKeyUp: (event) => {
              externalTextareaProps.onKeyUp?.(event);
              updateEditorContext(event);
            },
            onSelect: (event) => {
              externalTextareaProps.onSelect?.(event);
              updateEditorContext(event);
            },
          }}
        />
      </div>

      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/65 px-4 py-6 backdrop-blur-[1px]">
          <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg shadow-amber-950/5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-white p-2 text-amber-700 shadow-sm">
                <Lock className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="size-4 animate-spin" />
                  Editor locked
                </p>
                <p className="mt-1 text-sm text-amber-800">{lockMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimpleMDEditor;
