import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { getPublicSharePath } from "../utils/public-share";
import { applyShareMeta, compactMetaText } from "../utils/share-meta";
import LogoIcon from "../components/LogoIcon";
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Home,
  Library,
  Search,
  Store,
  UserRound,
} from "lucide-react";

const pageBackground = {
  backgroundColor: "#fbf7ed",
  backgroundImage:
    "linear-gradient(135deg, rgba(29,78,216,0.08) 0%, transparent 32%), linear-gradient(225deg, rgba(215,154,0,0.13) 0%, transparent 30%), radial-gradient(circle at 50% 0%, rgba(242,193,78,0.18), transparent 32rem)",
};

function getBookDescription(book) {
  return markdownToPlainText(book?.sales?.description || book?.subtitle || "")
    .replace(/\s+/g, " ")
    .trim();
}

function CommunityBookshelfPage() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");

  useEffect(() => {
    let isMounted = true;

    const fetchCommunityBooks = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data } = await axiosInstance.get(
          API_ENDPOINTS.PUBLIC.COMMUNITY_BOOKSHELF
        );

        if (isMounted) {
          setBooks(Array.isArray(data?.books) ? data.books : []);
        }
      } catch (error) {
        console.error("Error fetching community bookshelf:", error);

        if (isMounted) {
          setErrorMessage(
            error.response?.data?.error ||
              "The community bookshelf could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCommunityBooks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyShareMeta({
      title: "Bookify Community Bookshelf",
      description:
        "Browse books shared by Bookify authors, including free full PDFs, public previews, and purchase links for physical copies.",
      image: "/images/hero-image.png",
      type: "website",
    });
  }, []);

  const genres = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => String(book.genre || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return books.filter((book) => {
      const matchesGenre = genre === "all" || book.genre === genre;
      const searchable = [
        book.title,
        book.subtitle,
        book.author,
        book.genre,
        book.owner?.name,
        getBookDescription(book),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesGenre && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [books, genre, query]);

  const stats = useMemo(
    () => ({
      posted: books.length,
      free: books.filter((book) => book.communityListing?.freeFullPdfEnabled)
        .length,
      purchase: books.filter((book) => book.communityListing?.purchaseUrl)
        .length,
    }),
    [books]
  );

  return (
    <main className="min-h-screen text-[#171717]" style={pageBackground}>
      <header className="border-b border-[#ded6c6] bg-[#fffaf0]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-bold text-[#171717] outline-none transition hover:text-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#171717] text-white shadow-sm">
              <LogoIcon className="size-5" />
            </span>
            Bookify
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link
              to="/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ded6c6] bg-white px-3 text-[#56534d] transition hover:border-[#1d4ed8] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
            >
              <Home className="size-4" />
              Home
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#171717] px-3 text-white transition hover:bg-[#2f2d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79a00]"
            >
              <Library className="size-4" />
              My Books
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#1d4ed8]">
              Community Bookshelf
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-normal text-[#171717] md:text-6xl">
              Books Bookify authors are sharing now
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#56534d] md:text-lg">
              Browse community books, open free full PDFs when authors allow it,
              read public previews, and find purchase links for physical copies.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#ded6c6] bg-white/80 p-3">
              <p className="text-2xl font-black text-[#171717]">{stats.posted}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#746f66]">
                Posted
              </p>
            </div>
            <div className="rounded-lg border border-[#ded6c6] bg-white/80 p-3">
              <p className="text-2xl font-black text-[#1d4ed8]">{stats.free}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#746f66]">
                Free
              </p>
            </div>
            <div className="rounded-lg border border-[#ded6c6] bg-white/80 p-3">
              <p className="text-2xl font-black text-[#9a6700]">{stats.purchase}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#746f66]">
                Buy Links
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-3 rounded-lg border border-[#d7ccba] bg-[#fffdf7] p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="relative block">
            <span className="sr-only">Search community books</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#746f66]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, author, or topic"
              className="h-12 w-full rounded-md border border-[#ded6c6] bg-white py-2 pl-11 pr-4 text-sm font-semibold text-[#171717] placeholder:text-[#746f66] focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
            />
          </label>

          <label className="block">
            <span className="sr-only">Filter by genre</span>
            <select
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="h-12 w-full rounded-md border border-[#ded6c6] bg-white px-3 text-sm font-semibold text-[#171717] focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
            >
              <option value="all">All genres</option>
              {genres.map((genreOption) => (
                <option key={genreOption} value={genreOption}>
                  {genreOption}
                </option>
              ))}
            </select>
          </label>
        </section>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {isLoading ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <li
                key={index}
                className="h-[34rem] animate-pulse rounded-lg border border-[#ded6c6] bg-white/70"
              />
            ))}
          </ul>
        ) : errorMessage ? (
          <section className="rounded-lg border border-[#d7ccba] bg-white/80 px-6 py-14 text-center">
            <Library className="mx-auto mb-4 size-10 text-[#1d4ed8]" />
            <h2 className="text-2xl font-black text-[#171717]">
              Community shelf unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56534d]">
              {errorMessage}
            </p>
          </section>
        ) : filteredBooks.length === 0 ? (
          <section className="rounded-lg border border-dashed border-[#d7ccba] bg-white/70 px-6 py-14 text-center">
            <BookOpen className="mx-auto mb-4 size-10 text-[#d79a00]" />
            <h2 className="text-2xl font-black text-[#171717]">
              {books.length ? "No matching books" : "No books posted yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56534d]">
              {books.length
                ? "Try another search or clear the genre filter."
                : "Books posted from the editor will appear here."}
            </p>
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBooks.map((book) => {
              const coverImageUrl = book.coverImage
                ? resolveImageUrl(book.coverImage)
                : "/images/default-book-cover.jpg";
              const description = getBookDescription(book);
              const previewToken = book.previewShare?.token || "";
              const previewPath = previewToken
                ? getPublicSharePath(previewToken, book.owner?.name)
                : "";
              const authorShelfPath = book.owner?.bookshelfShare?.token
                ? getPublicSharePath(
                    book.owner.bookshelfShare.token,
                    book.owner?.name
                  )
                : "";
              const isFree = Boolean(book.communityListing?.freeFullPdfEnabled);
              const purchaseUrl = book.communityListing?.purchaseUrl || "";

              return (
                <li
                  key={book._id}
                  className="flex min-h-full flex-col overflow-hidden rounded-lg border border-[#ded6c6] bg-[#fffdf7] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c2b394] hover:shadow-md"
                >
                  <div className="relative aspect-[16/25] overflow-hidden bg-[#efe7d7]">
                    <img
                      src={coverImageUrl}
                      alt={`${book.title} cover`}
                      onError={(event) => {
                        event.currentTarget.src = "/images/default-book-cover.jpg";
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      {isFree && (
                        <span className="rounded-md bg-[#1d4ed8] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
                          Free PDF
                        </span>
                      )}
                      {purchaseUrl && (
                        <span className="rounded-md bg-[#f2c14e] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#171717] shadow-sm">
                          Physical Copy
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-xs font-black uppercase tracking-[0.18em] text-[#1d4ed8]">
                        {book.genre || "Book"}
                      </p>
                      <span className="shrink-0 text-xs font-semibold text-[#746f66]">
                        {book.chapterCount || 0} ch.
                      </span>
                    </div>

                    <h2 className="text-xl font-black leading-tight text-[#171717] line-clamp-2">
                      {book.title || "Untitled book"}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#56534d]">
                      <UserRound className="size-4" />
                      {book.author || book.owner?.name || "Bookify author"}
                    </p>

                    {description && (
                      <p className="mt-3 text-sm leading-6 text-[#56534d] line-clamp-3">
                        {compactMetaText(description, 190)}
                      </p>
                    )}

                    <div className="mt-auto grid gap-2 pt-5">
                      {isFree && (
                        <Link
                          to={`/community/books/${book._id}`}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1d4ed8] px-3 text-sm font-black text-white transition hover:bg-[#163ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                        >
                          <BookOpen className="size-4" />
                          View Free PDF
                        </Link>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {previewPath ? (
                          <Link
                            to={previewPath}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d7ccba] bg-white px-2 text-sm font-bold text-[#171717] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                          >
                            <ExternalLink className="size-4" />
                            Preview
                          </Link>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-md border border-[#e8dfcf] bg-[#f7f0e2] px-2 text-sm font-bold text-[#746f66]">
                            Preview
                          </span>
                        )}

                        {purchaseUrl ? (
                          <a
                            href={purchaseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#171717] px-2 text-sm font-bold text-white transition hover:bg-[#2f2d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79a00]"
                          >
                            <Store className="size-4" />
                            Buy Copy
                          </a>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-md border border-[#e8dfcf] bg-[#f7f0e2] px-2 text-sm font-bold text-[#746f66]">
                            Buy Copy
                          </span>
                        )}
                      </div>

                      {authorShelfPath && (
                        <Link
                          to={authorShelfPath}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-bold text-[#1d4ed8] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
                        >
                          Author Shelf
                          <ArrowUpRight className="size-4" />
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

export default CommunityBookshelfPage;
