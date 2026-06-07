import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import axiosInstance from "../lib/axios";
import {
  API_BASE_URL,
  API_ENDPOINTS,
  resolveImageUrl,
} from "../utils/api-endpoints";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { getPublicSharePath } from "../utils/public-share";
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
  backgroundColor: "#fbf7ed",
  backgroundImage:
    "radial-gradient(circle at 10% 8%, rgba(29,78,216,0.1), transparent 24rem), radial-gradient(circle at 86% 0%, rgba(215,154,0,0.14), transparent 26rem), linear-gradient(180deg, #fffaf0 0%, #eef3ff 100%)",
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

  const pdfUrl = `${API_BASE_URL}${API_ENDPOINTS.PUBLIC.COMMUNITY_BOOKSHELF}/${bookId}/pdf`;
  const coverImageUrl = book?.coverImage
    ? resolveImageUrl(book.coverImage)
    : "/images/default-book-cover.jpg";
  const description = useMemo(
    () =>
      markdownToPlainText(book?.sales?.description || book?.subtitle || "")
        .replace(/\s+/g, " ")
        .trim(),
    [book]
  );
  const previewToken = book?.previewShare?.token || "";
  const previewPath = previewToken
    ? getPublicSharePath(previewToken, book?.owner?.name)
    : "";
  const authorShelfPath = book?.owner?.bookshelfShare?.token
    ? getPublicSharePath(book.owner.bookshelfShare.token, book?.owner?.name)
    : "";
  const purchaseUrl = book?.communityListing?.purchaseUrl || "";
  const hasFullPdf = Boolean(book?.fullPdf?.enabled);

  useEffect(() => {
    if (!book) return;

    applyShareMeta({
      title: book.title ? `${book.title} | Bookify Community` : "Bookify Community",
      description:
        compactMetaText(description, 180) ||
        (hasFullPdf
          ? `Read the free full PDF of ${book.title}.`
          : `Browse ${book.title} on the Bookify Community Bookshelf.`),
      image: coverImageUrl,
      author: book.author || book.owner?.name,
      type: "book",
    });
  }, [book, coverImageUrl, description, hasFullPdf]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-8 text-[#171717]" style={readerBackground}>
        <div className="mx-auto grid max-w-7xl animate-pulse gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="h-[31rem] rounded-lg bg-white/70" />
          <div className="space-y-4">
            <div className="h-12 rounded-lg bg-white/70" />
            <div className="h-28 rounded-lg bg-white/70" />
            <div className="h-[36rem] rounded-lg bg-white/70" />
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage || !book) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4 text-[#171717]"
        style={readerBackground}
      >
        <section className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-[#171717] text-white">
            <Library className="size-7" />
          </div>
          <h1 className="text-2xl font-black">Community book unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#56534d]">
            {errorMessage || "This community book is not active."}
          </p>
          <Link
            to="/community"
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1d4ed8] px-4 text-sm font-black text-white transition hover:bg-[#163ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
          >
            <ArrowLeft className="size-4" />
            Community
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-[#171717]" style={readerBackground}>
      <header className="border-b border-[#ded6c6] bg-[#fffaf0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/community"
            className="inline-flex items-center gap-2 rounded-md text-sm font-black text-[#171717] transition hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
          >
            <ArrowLeft className="size-4" />
            Community
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md text-sm font-bold text-[#56534d] transition hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#171717] text-white">
              <LogoIcon className="size-4" />
            </span>
            Bookify
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <img
            src={coverImageUrl}
            alt={`${book.title} cover`}
            onError={(event) => {
              event.currentTarget.src = "/images/default-book-cover.jpg";
            }}
            className="mx-auto aspect-[16/25] w-full max-w-80 rounded-lg border border-[#ded6c6] bg-[#efe7d7] object-cover shadow-xl"
          />

          <div className="mt-4 rounded-lg border border-[#ded6c6] bg-[#fffdf7] p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d4ed8]">
              {book.genre || "Book"}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight">
              {book.title || "Untitled book"}
            </h1>
            {book.subtitle && (
              <p className="mt-2 text-sm leading-6 text-[#56534d]">
                {book.subtitle}
              </p>
            )}
            <p className="mt-3 text-sm font-semibold text-[#56534d]">
              by {book.author || book.owner?.name || "Bookify author"}
            </p>

            <div className="mt-5 grid gap-2">
              {hasFullPdf && (
                <>
                  <a
                    href={pdfUrl}
                    download
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1d4ed8] px-3 text-sm font-black text-white transition hover:bg-[#163ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                  >
                    <Download className="size-4" />
                    Download PDF
                  </a>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d7ccba] bg-white px-3 text-sm font-black text-[#171717] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                  >
                    <ExternalLink className="size-4" />
                    Open PDF
                  </a>
                </>
              )}

              {previewPath && (
                <Link
                  to={previewPath}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d7ccba] bg-white px-3 text-sm font-black text-[#171717] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                >
                  <BookOpen className="size-4" />
                  Read Preview
                </Link>
              )}

              {purchaseUrl && (
                <a
                  href={purchaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#171717] px-3 text-sm font-black text-white transition hover:bg-[#2f2d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79a00]"
                >
                  <Store className="size-4" />
                  Buy Copy
                </a>
              )}

              {authorShelfPath && (
                <Link
                  to={authorShelfPath}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-black text-[#1d4ed8] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                >
                  <Library className="size-4" />
                  Author Shelf
                </Link>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 rounded-lg border border-[#ded6c6] bg-[#fffdf7] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d79a00]">
              Community Reader
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal md:text-5xl">
              {hasFullPdf ? "Free full PDF" : "Full PDF is not enabled."}
            </h2>
            {description && (
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#56534d]">
                {compactMetaText(description, 460)}
              </p>
            )}
          </div>

          {hasFullPdf ? (
            <PdfFlipbook
              pdfUrl={pdfUrl}
              title={book.title || "Community PDF"}
              themeId="minimal-white"
              maxPages={0}
            />
          ) : (
            <section className="rounded-lg border border-dashed border-[#d7ccba] bg-white/70 px-6 py-16 text-center">
              <FileText className="mx-auto mb-4 size-12 text-[#1d4ed8]" />
              <h2 className="text-2xl font-black">
                This book is listed, but the full PDF is private.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56534d]">
                Use the preview or purchase link if the author provided one.
              </p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default CommunityBookReaderPage;
