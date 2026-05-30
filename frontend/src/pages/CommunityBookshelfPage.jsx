import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import { getPublicSharePath } from "../utils/public-share";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { applyShareMeta } from "../utils/share-meta";
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

const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim();

const getBookDescription = (book) => {
  const description =
    book?.sales?.description || book?.subtitle || book?.audience || "";

  return markdownToPlainText(description).slice(0, 210);
};

function CommunityBookshelfPage() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");

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
        "Browse books shared by Bookify authors, read free PDFs, open previews, and find purchase links for physical copies.",
      image: "/images/hero-image.png",
      type: "website",
    });
  }, []);

  const genres = useMemo(() => {
    const values = books
      .map((book) => String(book?.genre || "").trim())
      .filter(Boolean);

    return ["all", ...Array.from(new Set(values)).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return books.filter((book) => {
      const genre = String(book?.genre || "").trim();
      const matchesGenre = selectedGenre === "all" || genre === selectedGenre;
      const searchable = normalizeText(
        [
          book?.title,
          book?.subtitle,
          book?.author,
          book?.owner?.name,
          book?.genre,
          book?.audience,
          getBookDescription(book),
        ].join(" ")
      );

      return matchesGenre && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [books, query, selectedGenre]);
  const freePdfCount = books.filter(
    (book) => book?.communityListing?.freeFullPdfEnabled
  ).length;
  const purchaseLinkCount = books.filter(
    (book) => book?.communityListing?.purchaseUrl
  ).length;

  return (
    <main className="min-h-screen text-[#171717]" style={pageBackground}>
      <header className="border-b border-[#ded6c6] bg-white/76 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[#171717] text-white shadow-lg shadow-black/20">
              <LogoIcon className="size-5" />
            </span>
            <span className="font-headline text-xl font-black text-[#171717]">
              Bookify
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#4f4b43] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] sm:inline-flex"
            >
              <Home className="size-4" />
              Home
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1d4ed8] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#1d4ed8]/20 transition hover:bg-[#173ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
            >
              Dashboard
              <ArrowUpRight className="size-4" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-[#ded6c6]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_22rem] lg:px-8 lg:py-14">
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7ccba] bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#1d4ed8]">
              <Library className="size-3.5" />
              Community Bookshelf
            </p>
            <h1 className="max-w-4xl font-headline text-4xl font-black leading-[1.02] text-[#171717] md:text-6xl">
              Books posted by Bookify authors.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#56534d] md:text-lg">
              Browse what people are making, view free full-book PDFs when
              authors allow it, and follow purchase links when a physical copy
              is ready.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 self-end">
            <div className="rounded-xl border border-[#ded6c6] bg-white/80 p-4">
              <p className="text-3xl font-black text-[#171717]">{books.length}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#746f66]">
                Posted
              </p>
            </div>
            <div className="rounded-xl border border-[#ded6c6] bg-white/80 p-4">
              <p className="text-3xl font-black text-[#1d4ed8]">
                {freePdfCount}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#746f66]">
                Free
              </p>
            </div>
            <div className="rounded-xl border border-[#ded6c6] bg-white/80 p-4">
              <p className="text-3xl font-black text-[#d79a00]">
                {purchaseLinkCount}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#746f66]">
                Buy links
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
          <label className="relative block">
            <span className="sr-only">Search books</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#746f66]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, author, genre..."
              className="h-12 w-full rounded-xl border border-[#d7ccba] bg-white/86 pl-12 pr-4 text-sm font-semibold text-[#171717] outline-none transition placeholder:text-[#8b857b] focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20"
            />
          </label>

          <label className="block">
            <span className="sr-only">Filter by genre</span>
            <select
              value={selectedGenre}
              onChange={(event) => setSelectedGenre(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#d7ccba] bg-white/86 px-4 text-sm font-bold text-[#171717] outline-none transition focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20"
            >
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre === "all" ? "All genres" : genre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[34rem] animate-pulse rounded-xl border border-[#ded6c6] bg-white/70"
              />
            ))}
          </div>
        ) : errorMessage ? (
          <section className="rounded-xl border border-[#ded6c6] bg-white/80 px-6 py-16 text-center">
            <Library className="mx-auto mb-4 size-11 text-[#1d4ed8]" />
            <h2 className="text-2xl font-black text-[#171717]">
              Bookshelf unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#56534d]">
              {errorMessage}
            </p>
          </section>
        ) : books.length === 0 ? (
          <section className="rounded-xl border-2 border-dashed border-[#d7ccba] bg-white/62 px-6 py-16 text-center">
            <BookOpen className="mx-auto mb-4 size-11 text-[#746f66]" />
            <h2 className="text-2xl font-black text-[#171717]">
              No books posted yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#56534d]">
              Community books will appear here as authors choose to post them.
            </p>
          </section>
        ) : filteredBooks.length === 0 ? (
          <section className="rounded-xl border-2 border-dashed border-[#d7ccba] bg-white/62 px-6 py-16 text-center">
            <BookOpen className="mx-auto mb-4 size-11 text-[#746f66]" />
            <h2 className="text-2xl font-black text-[#171717]">
              No matching books
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#56534d]">
              Try a different search or clear the genre filter.
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
              const purchaseUrl = book.communityListing?.purchaseUrl || "";
              const isFreePdfEnabled = Boolean(
                book.communityListing?.freeFullPdfEnabled
              );
              const shelfToken = book.owner?.bookshelfShare?.token || "";
              const authorShelfPath = shelfToken
                ? getPublicSharePath(shelfToken, book.owner?.name)
                : "";

              return (
                <li
                  key={book._id}
                  className="group overflow-hidden rounded-xl border border-[#ded6c6] bg-white shadow-sm shadow-black/5 transition hover:-translate-y-1 hover:border-[#c9bfae] hover:shadow-xl hover:shadow-[#1d4ed8]/10"
                >
                  <div className="relative bg-[#eef3ff]">
                    <img
                      src={coverImageUrl}
                      alt={`${book.title} cover`}
                      onError={(event) => {
                        event.currentTarget.src = "/images/default-book-cover.jpg";
                      }}
                      className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      {isFreePdfEnabled && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1d4ed8] px-3 py-1 text-xs font-black text-white shadow-lg shadow-black/10">
                          <BookOpen className="size-3.5" />
                          FREE PDF
                        </span>
                      )}
                      {purchaseUrl && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2c14e] px-3 py-1 text-xs font-black text-[#241b06] shadow-lg shadow-black/10">
                          <Store className="size-3.5" />
                          Physical copy
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#1d4ed8]">
                        {book.genre || "Book"}
                      </span>
                      <span className="text-xs font-bold text-[#8b857b]">
                        {book.chapterCount} chapters
                      </span>
                    </div>

                    <h2 className="text-xl font-black leading-tight text-[#171717] line-clamp-2">
                      {book.title}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#56534d]">
                      <UserRound className="size-4 text-[#1d4ed8]" />
                      {book.author || book.owner?.name || "Bookify author"}
                    </p>

                    {description && (
                      <p className="mt-4 min-h-16 text-sm leading-6 text-[#56534d] line-clamp-3">
                        {description}
                      </p>
                    )}

                    <div className="mt-5 grid grid-cols-1 gap-2">
                      {isFreePdfEnabled && (
                        <Link
                          to={`/community/books/${book._id}`}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] px-4 text-sm font-black text-white transition hover:bg-[#173ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
                        >
                          <BookOpen className="size-4" />
                          View Free PDF
                        </Link>
                      )}

                      {previewToken && (
                        <Link
                          to={getPublicSharePath(previewToken, book.owner?.name)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-black text-white transition hover:bg-[#2a2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
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
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#d79a00] px-4 text-sm font-black text-[#171717] transition hover:bg-[#bf8700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
                        >
                          <Store className="size-4" />
                          Buy Copy
                        </a>
                      )}

                      {authorShelfPath && (
                        <Link
                          to={authorShelfPath}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d7ccba] bg-white px-4 text-sm font-bold text-[#3f3b34] transition hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2"
                        >
                          <ExternalLink className="size-4" />
                          Author Shelf
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
