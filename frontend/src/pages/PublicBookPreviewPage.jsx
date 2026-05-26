import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import axiosInstance from "../lib/axios";
import {
  API_BASE_URL,
  API_ENDPOINTS,
  resolveImageUrl,
} from "../utils/api-endpoints";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { getPublicShareTheme } from "../utils/public-share";
import PdfFlipbook from "../components/PdfFlipbook";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Linkedin,
  Share2,
  Store,
} from "lucide-react";
import toast from "react-hot-toast";

const copyCurrentUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Preview link copied.");
  } catch {
    toast.error("Could not copy the link.");
  }
};

function PublicBookPreviewPage() {
  const { shareToken } = useParams();
  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchPreview = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.PUBLIC.BOOK_PREVIEW}/${shareToken}`
        );

        if (isMounted) {
          setBook(data?.book || null);
        }
      } catch (error) {
        console.error("Error fetching book preview:", error);

        if (isMounted) {
          setErrorMessage(
            error.response?.data?.error || "This preview link is not active."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [shareToken]);

  const coverImageUrl = book?.coverImage
    ? resolveImageUrl(book.coverImage)
    : "/images/default-book-cover.jpg";
  const chapterTitle = book?.firstChapter?.title || "First Chapter";
  const description =
    book?.sales?.description ||
    book?.sales?.backCoverBlurb ||
    book?.subtitle ||
    book?.firstChapter?.description ||
    "";
  const storeUrl = book?.owner?.storeUrl || "";
  const theme = getPublicShareTheme(book?.owner?.publicShareTheme);
  const pdfUrl = `${API_BASE_URL}${API_ENDPOINTS.PUBLIC.BOOK_PREVIEW}/${shareToken}/pdf`;
  const socialText = encodeURIComponent(
    book?.title ? `Read the first chapter of ${book.title}` : "Read this preview"
  );
  const socialUrl =
    typeof window === "undefined" ? "" : encodeURIComponent(window.location.href);

  if (isLoading) {
    return (
      <main className={`min-h-screen ${theme.page} px-5 py-10`}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[22rem_1fr] gap-8 animate-pulse">
          <div className={`h-[34rem] ${theme.skeleton} rounded-xl`} />
          <div className="space-y-5">
            <div className={`h-14 ${theme.skeleton} rounded-xl`} />
            <div className={`h-28 ${theme.skeleton} rounded-xl`} />
            <div className={`h-96 ${theme.skeleton} rounded-xl`} />
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage || !book) {
    return (
      <main className={`min-h-screen ${theme.hero} flex items-center justify-center px-5`}>
        <section className="max-w-md text-center">
          <div className="size-14 rounded-xl bg-white/10 mx-auto mb-4 flex items-center justify-center">
            <BookOpen className={`size-7 ${theme.eyebrow}`} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Preview unavailable</h1>
          <p className={`${theme.heroMuted} text-sm`}>
            {errorMessage || "This preview link is not active."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${theme.page}`}>
      <section className={theme.hero}>
        <div className="max-w-6xl mx-auto px-5 py-5">
          <Link
            to="/"
            className={`inline-flex items-center gap-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 rounded-lg ${theme.heroLink}`}
          >
            <ArrowLeft className="size-4" />
            Bookify
          </Link>
        </div>
      </section>

      <section className={`${theme.hero} border-b ${theme.heroBorder}`}>
        <div className="max-w-6xl mx-auto px-5 pb-10 md:pb-14 grid lg:grid-cols-[20rem_1fr] gap-8 lg:gap-12 items-end">
          <div className="relative max-w-72 lg:max-w-none mx-auto w-full">
            <img
              src={coverImageUrl}
              alt={`${book.title} cover`}
              onError={(event) => {
                event.currentTarget.src = "/images/default-book-cover.jpg";
              }}
              className="relative w-full aspect-16/25 object-cover rounded-xl shadow-2xl shadow-black/25 border border-white/10"
            />
          </div>

          <div className="pb-2">
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${theme.eyebrow} mb-4`}>
              First Chapter Preview
            </p>
            <h1 className="text-4xl md:text-6xl font-black leading-[0.98] max-w-3xl">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className={`text-xl ${theme.heroMuted} mt-4 max-w-2xl`}>
                {book.subtitle}
              </p>
            )}
            <p className={`text-sm ${theme.heroSubtle} mt-4`}>by {book.author}</p>

            {description && (
              <p className={`text-base md:text-lg ${theme.heroBody} leading-8 mt-7 max-w-3xl`}>
                {markdownToPlainText(description).slice(0, 700)}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {storeUrl && (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.primaryButton}`}
                >
                  <Store className="size-4" />
                  Store Link
                </a>
              )}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.secondaryButton}`}
              >
                <FileText className="size-4" />
                Open PDF Preview
              </a>
              <button
                type="button"
                onClick={copyCurrentUrl}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.ghostButton}`}
              >
                <Copy className="size-4" />
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-10 md:py-14 grid lg:grid-cols-[1fr_18rem] gap-8">
        <div>
          <div className="mb-5">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.cardEyebrow} mb-2`}>
                PDF Flipbook
              </p>
              <h2 className="text-2xl md:text-3xl font-black">{chapterTitle}</h2>
            </div>
          </div>
          <PdfFlipbook
            pdfUrl={pdfUrl}
            title={chapterTitle}
            themeId={book?.owner?.publicShareTheme}
          />
        </div>

        <aside className="space-y-4">
          {storeUrl && (
            <section className={`rounded-xl border p-5 shadow-sm ${theme.card}`}>
              <h3 className={`text-sm font-black uppercase tracking-[0.16em] ${theme.cardEyebrow} mb-4`}>
                Store
              </h3>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.primaryButton}`}
              >
                <Store className="size-4" />
                Store Link
              </a>
            </section>
          )}

          <section className={`rounded-xl border p-5 shadow-sm ${theme.card}`}>
            <h3 className={`text-sm font-black uppercase tracking-[0.16em] ${theme.cardEyebrow} mb-4`}>
              Share Preview
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://twitter.com/intent/tweet?text=${socialText}&url=${socialUrl}`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.darkButton}`}
              >
                <Share2 className="size-4" />
                X
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${socialUrl}`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.secondaryButton}`}
              >
                <Linkedin className="size-4" />
                LinkedIn
              </a>
              <button
                type="button"
                onClick={copyCurrentUrl}
                className={`col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.outline}`}
              >
                <Copy className="size-4" />
                Copy page link
              </button>
            </div>
          </section>

          <section className={`rounded-xl border p-5 shadow-sm ${theme.card}`}>
            <h3 className={`text-sm font-black uppercase tracking-[0.16em] ${theme.cardEyebrow} mb-4`}>
              PDF
            </h3>
            <div className="space-y-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.secondaryButton}`}
              >
                <ExternalLink className="size-4" />
                Open PDF
              </a>
              <a
                href={pdfUrl}
                download
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${theme.outline}`}
              >
                <Download className="size-4" />
                Download
              </a>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default PublicBookPreviewPage;
