import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import axiosInstance from "../lib/axios";
import {
  API_BASE_URL,
  API_ENDPOINTS,
  resolveImageUrl,
} from "../utils/api-endpoints";
import { getPublicSharePath } from "../utils/public-share";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { applyShareMeta, compactMetaText } from "../utils/share-meta";
import PdfFlipbook from "../components/PdfFlipbook";
import LogoIcon from "../components/LogoIcon";
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Library,
  Store,
} from "lucide-react";

const readerBackground = {
  backgroundColor: "#f5f2ea",
  backgroundImage:
    "radial-gradient(circle at 10% 8%, rgba(193,63,40,0.12), transparent 24rem), radial-gradient(circle at 86% 0%, rgba(23,63,45,0.14), transparent 26rem), linear-gradient(180deg, #fffaf0 0%, #eef6ed 100%)",
};

function CommunityBookReaderPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchBook = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.PUBLIC.COMMUNITY_BOOKSHELF}/${bookId}`
        );

        if (isMounted) {
          setBook(data?.book || null);
        }
      } catch (error) {
        console.error("Error fetching community book:", error);

        if (isMounted) {
          setErrorMessage(
            error.response?.data?.error || "This community book is not active."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBook();

    return () => {
      isMounted = false;
    };
  }, [bookId]);

  const coverImageUrl = book?.coverImage
    ? resolveImageUrl(book.coverImage)
    : "/images/default-book-cover.jpg";
  const description = markdownToPlainText(
    book?.sales?.description || book?.subtitle || ""
  );
  const pdfUrl = `${API_BASE_URL}${API_ENDPOINTS.PUBLIC.COMMUNITY_BOOKSHELF}/${bookId}/pdf`;
  const purchaseUrl = book?.communityListing?.purchaseUrl || "";
  const previewToken = book?.previewShare?.token || "";
  const previewPath = previewToken
    ? getPublicSharePath(previewToken, book?.owner?.name)
    : "";

  const title = useMemo(() => {
    if (!book?.title) return "Bookify Community Reader";

    return `${book.title} | Bookify Community`;
  }, [book?.title]);

  useEffect(() => {
    if (!book) return;

    applyShareMeta({
      title,
      description: compactMetaText(
        description || `Read ${book.title} from the Bookify community.`,
        180
      ),
      image: coverImageUrl,
      author: book.author || book.owner?.name,
      type: "book",
    });
  }, [book, coverImageUrl, description, title]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-5 py-10" style={readerBackground}>
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-8 h-10 w-48 rounded-xl bg-emerald-100" />
          <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
            <div className="h-[28rem] rounded-xl bg-emerald-100" />
            <div className="h-[38rem] rounded-xl bg-emerald-100" />
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage || !book) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={readerBackground}
      >
        <section className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-[#173f2d] text-white">
            <Library className="size-7" />
          </div>
          <h1 className="text-2xl font-black text-[#10231b]">
            Book unavailable
          </h1>
          <p className="mt-2 text-sm text-[#496253]">
            {errorMessage || "This community book is not active."}
          </p>
          <Link
            to="/community"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#173f2d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#102f21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" />
            Community
          </Link>
        </section>
      </main>
    );
  }

  const isFreePdfEnabled = Boolean(book?.fullPdf?.enabled);

  return (
    <main className="min-h-screen text-[#10231b]" style={readerBackground}>
      <header className="border-b border-[#d6e5d5] bg-white/76 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <Link
            to="/community"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#173f2d] text-white shadow-lg shadow-[#173f2d]/20">
              <LogoIcon className="size-5" />
            </span>
            <span className="font-headline text-xl font-black text-[#10231b]">
              Bookify
            </span>
          </Link>

          <Link
            to="/community"
            className="inline-flex items-center gap-2 rounded-xl border border-[#cfe2cd] bg-white px-4 py-2 text-sm font-bold text-[#31513f] transition hover:bg-[#e9f3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" />
            Community
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[18rem_1fr] lg:px-8 lg:py-10">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <img
            src={coverImageUrl}
            alt={`${book.title} cover`}
            onError={(event) => {
              event.currentTarget.src = "/images/default-book-cover.jpg";
            }}
            className="mx-auto aspect-[4/5] w-full max-w-72 rounded-xl border border-white/70 object-cover shadow-2xl shadow-[#173f2d]/18"
          />

          <div className="mt-5 grid gap-2">
            {isFreePdfEnabled && (
              <>
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#c13f28] px-4 text-sm font-black text-white transition hover:bg-[#9d321f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
                >
                  <Download className="size-4" />
                  Download PDF
                </a>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cfe2cd] bg-white px-4 text-sm font-bold text-[#31513f] transition hover:bg-[#e9f3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
                >
                  <ExternalLink className="size-4" />
                  Open PDF
                </a>
              </>
            )}
            {previewPath && (
              <Link
                to={previewPath}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cfe2cd] bg-white px-4 text-sm font-bold text-[#31513f] transition hover:bg-[#e9f3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
              >
                <BookOpen className="size-4" />
                First Chapter
              </Link>
            )}
            {purchaseUrl && (
              <a
                href={purchaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#cfe2cd] bg-white px-4 text-sm font-bold text-[#31513f] transition hover:bg-[#e9f3e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13f28] focus-visible:ring-offset-2"
              >
                <Store className="size-4" />
                Buy Copy
              </a>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-6">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#cfe2cd] bg-white/74 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#c13f28]">
              <FileText className="size-3.5" />
              Free Community PDF
            </p>
            <h1 className="max-w-4xl font-headline text-4xl font-black leading-[1.02] text-[#10231b] md:text-6xl">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="mt-4 max-w-3xl text-xl font-semibold leading-8 text-[#496253]">
                {book.subtitle}
              </p>
            )}
            <p className="mt-3 text-sm font-bold text-[#6a7f70]">
              by {book.author || book.owner?.name || "Bookify author"}
            </p>
            {description && (
              <p className="mt-5 max-w-3xl text-base leading-7 text-[#496253]">
                {description.slice(0, 520)}
              </p>
            )}
          </div>

          {isFreePdfEnabled ? (
            <PdfFlipbook
              pdfUrl={pdfUrl}
              title={book.title}
              themeId="teal-lime"
              maxPages={0}
            />
          ) : (
            <section className="rounded-xl border border-[#d6e5d5] bg-white/80 px-6 py-14 text-center shadow-xl shadow-[#173f2d]/8">
              <FileText className="mx-auto mb-4 size-11 text-[#6a7f70]" />
              <h2 className="text-2xl font-black text-[#10231b]">
                Full PDF is not enabled
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#496253]">
                The author has listed this book in the community, but has not
                enabled free full-PDF viewing.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default CommunityBookReaderPage;
