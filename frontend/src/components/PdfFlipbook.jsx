import { forwardRef, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import * as pdfjs from "pdfjs-dist";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { getPublicShareTheme } from "../utils/public-share";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

const MAX_PREVIEW_PAGES = 24;

const FlipbookImagePage = forwardRef(({ page, theme }, ref) => (
  <div
    ref={ref}
    className={`overflow-hidden shadow-xl ${theme.flipbookPage}`}
    data-density={page.pageNumber === 1 ? "hard" : "soft"}
  >
    <img
      src={page.src}
      alt={`Preview PDF page ${page.pageNumber}`}
      draggable={false}
      className="h-full w-full bg-white object-contain"
    />
  </div>
));

FlipbookImagePage.displayName = "FlipbookImagePage";

async function renderPdfPages(pdfUrl, { signal, onProgress }) {
  const loadingTask = pdfjs.getDocument({ url: pdfUrl });

  signal.addEventListener("abort", () => {
    loadingTask.destroy();
  });

  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, MAX_PREVIEW_PAGES);
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (signal.aborted) return pages;

    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 620;
    const cssScale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: cssScale });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    pages.push({
      pageNumber,
      src: canvas.toDataURL("image/jpeg", 0.92),
    });
    onProgress?.({
      complete: pageNumber,
      total: pageCount,
    });
  }

  return pages;
}

function PdfFlipbook({ pdfUrl, title = "Preview PDF", themeId = "" }) {
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState({ complete: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(0);
  const flipbookRef = useRef(null);
  const theme = getPublicShareTheme(themeId);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;

      setIsLoading(true);
      setErrorMessage("");
      setPages([]);
      setProgress({ complete: 0, total: 0 });
      setCurrentPage(0);
    });

    renderPdfPages(pdfUrl, {
      signal: controller.signal,
      onProgress: setProgress,
    })
      .then((nextPages) => {
        if (!controller.signal.aborted) {
          setPages(nextPages);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Error rendering PDF flipbook:", error);
          setErrorMessage("The PDF preview could not be rendered.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [pdfUrl]);

  const goPrevious = () => {
    flipbookRef.current?.pageFlip?.().flipPrev();
  };

  const goNext = () => {
    flipbookRef.current?.pageFlip?.().flipNext();
  };

  const goFirst = () => {
    flipbookRef.current?.pageFlip?.().flip(0);
  };

  if (isLoading) {
    const percentage = progress.total
      ? Math.round((progress.complete / progress.total) * 100)
      : 12;

    return (
      <section className={`rounded-xl p-6 shadow-2xl ${theme.flipbookBg}`}>
        <div className="min-h-[31rem] rounded-lg border border-white/10 bg-white/5 flex flex-col items-center justify-center px-6 text-center">
          <Loader2 className={`size-9 animate-spin ${theme.flipbookAccent} mb-4`} />
          <p className="text-sm font-bold">Rendering PDF preview</p>
          <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${theme.flipbookProgress}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  if (errorMessage || pages.length === 0) {
    return (
      <section className={`rounded-xl p-6 shadow-2xl ${theme.flipbookBg}`}>
        <div className="min-h-[31rem] rounded-lg border border-white/10 bg-white/5 flex flex-col items-center justify-center px-6 text-center">
          <AlertCircle className={`size-10 ${theme.flipbookAccent} mb-4`} />
          <p className="text-sm font-bold">
            {errorMessage || "No PDF pages were found."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-xl p-3 md:p-6 shadow-2xl ${theme.flipbookBg}`}>
      <div className={`relative min-h-[31rem] overflow-hidden rounded-lg py-5 ${theme.flipbookGlow}`}>
        <HTMLFlipBook
          ref={flipbookRef}
          width={430}
          height={610}
          size="stretch"
          minWidth={280}
          maxWidth={620}
          minHeight={395}
          maxHeight={760}
          showCover
          drawShadow
          flippingTime={760}
          usePortrait
          mobileScrollSupport
          className="mx-auto"
          onFlip={(event) => setCurrentPage(event.data)}
        >
          {pages.map((page) => (
            <FlipbookImagePage
              key={page.pageNumber}
              page={page}
              theme={theme}
            />
          ))}
        </HTMLFlipBook>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.flipbookCaption}`}>
          {title} - {currentPage + 1} / {pages.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goFirst}
            disabled={currentPage === 0}
            className={`size-10 rounded-xl inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 ${theme.flipbookControl}`}
            aria-label="Restart flipbook"
            title="Restart"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentPage === 0}
            className={`size-10 rounded-xl inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 ${theme.flipbookControl}`}
            aria-label="Previous page"
            title="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= pages.length - 1}
            className={`size-10 rounded-xl inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 ${theme.flipbookPrimary}`}
            aria-label="Next page"
            title="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default PdfFlipbook;
