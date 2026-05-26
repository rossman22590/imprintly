import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import {
  getPublicSharePath,
  getPublicShareTheme,
} from "../utils/public-share";
import {
  applyShareMeta,
  compactMetaText,
  getOwnerShareImage,
} from "../utils/share-meta";
import {
  BookOpen,
  Copy,
  ExternalLink,
  Library,
  Share2,
  Store,
} from "lucide-react";
import toast from "react-hot-toast";

const copyCurrentUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Bookshelf link copied.");
  } catch {
    toast.error("Could not copy the link.");
  }
};

function PublicBookshelfPage() {
  const { shareToken } = useParams();
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [shelfPhotoFailed, setShelfPhotoFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchBookshelf = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.PUBLIC.BOOKSHELF}/${shareToken}`
        );

        if (isMounted) {
          setPayload(data);
        }
      } catch (error) {
        console.error("Error fetching public bookshelf:", error);

        if (isMounted) {
          setErrorMessage(
            error.response?.data?.error || "This bookshelf link is not active."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBookshelf();

    return () => {
      isMounted = false;
    };
  }, [shareToken]);

  useEffect(() => {
    setShelfPhotoFailed(false);
  }, [payload?.owner?.shelfPhotoUrl]);

  const books = useMemo(
    () => (Array.isArray(payload?.books) ? payload.books : []),
    [payload]
  );
  const theme = getPublicShareTheme(payload?.owner?.publicShareTheme);
  const storeUrl = payload?.owner?.storeUrl || "";
  const shelfDisplayName =
    payload?.owner?.shelfPageName ||
    `${payload?.owner?.name || "Author"}'s bookshelf`;
  const firstBookCover = books[0]?.coverImage || "";
  const shelfPhotoUrl =
    !shelfPhotoFailed && payload?.owner?.shelfPhotoUrl
      ? resolveImageUrl(payload.owner.shelfPhotoUrl)
      : "";
  const shareImageUrl = getOwnerShareImage(payload?.owner, firstBookCover);

  useEffect(() => {
    if (!payload) return;

    applyShareMeta({
      title: payload.owner?.publicShareMetaTitle || shelfDisplayName,
      description:
        payload.owner?.publicShareMetaDescription ||
        compactMetaText(
          `Browse ${payload.owner?.name || "this author"}'s shared bookshelf with ${
            books.length
          } ${books.length === 1 ? "book" : "books"}.`
        ),
      image: resolveImageUrl(shareImageUrl),
      author: payload.owner?.name,
      type: "website",
    });
  }, [books.length, payload, shareImageUrl, shelfDisplayName]);

  if (isLoading) {
    return (
      <main className={`min-h-screen ${theme.page} px-5 py-10`}>
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className={`h-12 w-72 ${theme.skeleton} rounded-xl mb-8`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`h-96 ${theme.skeleton} rounded-xl`} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className={`min-h-screen ${theme.hero} flex items-center justify-center px-5`}>
        <section className="max-w-md text-center">
          <div className="size-14 rounded-xl bg-white/10 mx-auto mb-4 flex items-center justify-center">
            <Library className={`size-7 ${theme.eyebrow}`} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Bookshelf unavailable</h1>
          <p className={`${theme.heroMuted} text-sm`}>{errorMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${theme.page}`}>
      <section className={`border-b ${theme.heroBorder} ${theme.hero}`}>
        <div className="max-w-6xl mx-auto px-5 py-8 md:py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {shelfPhotoUrl && (
              <div className={`size-24 md:size-28 shrink-0 overflow-hidden rounded-2xl border ${theme.iconBorder} bg-white/10 shadow-2xl`}>
                <img
                  src={shelfPhotoUrl}
                  alt={`${shelfDisplayName} shelf`}
                  onError={() => setShelfPhotoFailed(true)}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.eyebrow} mb-3`}>
                Shared Bookshelf
              </p>
              <h1 className="text-3xl md:text-5xl font-black leading-tight">
                {shelfDisplayName}
              </h1>
              <p className={`text-sm ${theme.heroMuted} mt-3`}>
                {books.length} {books.length === 1 ? "book" : "books"} available
                to browse.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={copyCurrentUrl}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${theme.primaryButton}`}
          >
            <Copy className="size-4" />
            Copy Shelf Link
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-8 md:py-10">
        {books.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed ${theme.iconBorder} bg-white/70 px-6 py-16 text-center`}>
            <BookOpen className={`size-10 ${theme.icon} mx-auto mb-3`} />
            <h2 className="text-xl font-bold">No books yet</h2>
            <p className={`${theme.cardMuted} text-sm mt-2`}>
              This shared shelf is active, but it does not have any books yet.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {books.map((book) => {
              const coverImageUrl = book.coverImage
                ? resolveImageUrl(book.coverImage)
                : "/images/default-book-cover.jpg";
              const previewToken = book.previewShare?.token || "";

              return (
                <li
                  key={book._id}
                  className={`border rounded-xl overflow-hidden shadow-sm ${theme.card}`}
                >
                  <div className={`aspect-16/25 ${theme.soft} overflow-hidden`}>
                    <img
                      src={coverImageUrl}
                      alt={`${book.title} cover`}
                      onError={(event) => {
                        event.currentTarget.src = "/images/default-book-cover.jpg";
                      }}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <p className={`text-xs font-semibold uppercase ${theme.cardEyebrow} mb-2`}>
                      {book.genre || "Book"}
                    </p>
                    <h2 className="text-lg font-bold leading-tight line-clamp-2">
                      {book.title}
                    </h2>
                    <p className={`text-sm ${theme.cardMuted} mt-1`}>
                      by {book.author}
                    </p>
                    {book.subtitle && (
                      <p className={`text-sm ${theme.cardBody} mt-3 line-clamp-2`}>
                        {book.subtitle}
                      </p>
                    )}

                    <div className="mt-5 flex gap-2">
                      {previewToken ? (
                        <Link
                          to={getPublicSharePath(previewToken, payload?.owner?.name)}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${theme.darkButton}`}
                        >
                          <BookOpen className="size-4" />
                          Preview
                        </Link>
                      ) : storeUrl ? (
                        <a
                          href={storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${theme.primaryButton}`}
                        >
                          <Store className="size-4" />
                          Store Link
                        </a>
                      ) : (
                        <span className={`flex-1 inline-flex items-center justify-center rounded-xl ${theme.soft} px-4 py-2.5 text-sm font-semibold ${theme.softText}`}>
                          No preview
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const url = previewToken
                            ? `${window.location.origin}${getPublicSharePath(
                                previewToken,
                                payload?.owner?.name
                              )}`
                            : window.location.href;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copied.");
                        }}
                        className={`size-10 rounded-xl border inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 ${theme.icon} ${theme.iconBorder}`}
                        aria-label="Copy book link"
                        title="Copy book link"
                      >
                        <Share2 className="size-4" />
                      </button>
                      {previewToken && (
                        <Link
                          to={getPublicSharePath(previewToken, payload?.owner?.name)}
                          className={`size-10 rounded-xl border inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 ${theme.icon} ${theme.iconBorder}`}
                          aria-label="Open preview"
                          title="Open preview"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default PublicBookshelfPage;
