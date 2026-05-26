import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { normalizeBooks } from "../utils/api-shapes";
import toast from "react-hot-toast";
import DashboardLayout from "../layouts/DashboardLayout";
import { BookCard, Button, CreateBookModal } from "../components";
import { Book, BookOpen, BookPlus, LayoutGrid, PencilLine } from "lucide-react";

const BOOKS_PER_ROW = 5;

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------
const BookCardSkeleton = ({ variant = "shelf" }) => {
  if (variant === "flat") {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm animate-pulse">
        <div className="w-full aspect-16/25 bg-gray-200 rounded-t-xl" />
        <div className="p-4">
          <div className="w-3/4 h-5 md:h-6 bg-gray-200 rounded mb-2" />
          <div className="w-1/2 h-3 md:h-4 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative animate-pulse">
      <div className="absolute -bottom-4 left-3 right-3 h-5 rounded-full bg-black/15 blur-md" />
      <div className="relative mx-auto w-full max-w-60">
        <div className="absolute inset-y-2 -right-3 w-5 rounded-r-lg bg-stone-200" />
        <div className="absolute inset-y-3 -left-3 w-5 rounded-l-lg bg-stone-400" />
        <div className="aspect-16/25 rounded-lg bg-linear-to-br from-slate-200 via-stone-200 to-slate-300 shadow-xl" />
      </div>
      <div className="mt-5 h-3 rounded-full bg-stone-300" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// View mode toggle
// ---------------------------------------------------------------------------
const ViewModeToggle = ({ isShelfView, onChange, theme = "light" }) => {
  const isShelfTheme = theme === "shelf";

  if (isShelfTheme) {
    return (
      <div
        className="flex p-[3px] rounded-xl gap-[3px]"
        style={{
          background: "rgba(10,5,2,0.7)",
          border: "1px solid rgba(180,120,50,0.3)",
          boxShadow: "inset 0 1px 0 rgba(255,230,170,0.08), 0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {[
          { id: "shelf", label: "3D Shelf", icon: BookOpen },
          { id: "flat", label: "Standard", icon: LayoutGrid },
        ].map(({ id, label }) => {
          const isActive = isShelfView ? id === "shelf" : id === "flat";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={isActive}
              className="relative h-9 px-4 rounded-[9px] inline-flex items-center gap-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c47e]"
              style={
                isActive
                  ? {
                      background: "linear-gradient(145deg, #c8922a 0%, #e8b84a 50%, #c07820 100%)",
                      color: "#1a0d04",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                    }
                  : { color: "rgba(240,210,150,0.6)" }
              }
            >
              {id === "shelf" ? (
                <BookOpen className="size-3.5" />
              ) : (
                <LayoutGrid className="size-3.5" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex p-[3px] rounded-xl gap-[3px] bg-gray-100 border border-gray-200">
      {[
        { id: "shelf", label: "3D Shelf", icon: BookOpen },
        { id: "flat", label: "Standard", icon: LayoutGrid },
      ].map(({ id, label }) => {
        const isActive = isShelfView ? id === "shelf" : id === "flat";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={isActive}
            className={`h-9 px-3 rounded-[9px] inline-flex items-center gap-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {id === "shelf" ? (
              <BookOpen className="size-3.5" />
            ) : (
              <LayoutGrid className="size-3.5" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shelf plank — the wooden ledge each row of books rests on
// ---------------------------------------------------------------------------
const ShelfPlank = () => (
  <div
    className="relative z-20 h-[22px] rounded-[3px] mt-6"
    style={{
      backgroundImage:
        "linear-gradient(180deg, rgba(255,240,200,0.55) 0%, rgba(200,138,60,0.72) 12%, rgba(120,68,24,0.92) 44%, rgba(54,26,8,0.98) 78%, rgba(18,8,2,1) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 28px)",
      boxShadow:
        "inset 0 2px 0 rgba(255,242,200,0.45), inset 0 -6px 14px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.5), 0 18px 40px rgba(0,0,0,0.28)",
    }}
  >
    {/* Front-face highlight stripe */}
    <div
      className="absolute inset-x-0 top-0 h-[3px] rounded-t-sm"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,240,190,0.0) 0%, rgba(255,240,190,0.55) 20%, rgba(255,240,190,0.72) 50%, rgba(255,240,190,0.55) 80%, rgba(255,240,190,0.0) 100%)",
      }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Room style constants
// ---------------------------------------------------------------------------
const roomBgStyle = {
  backgroundColor: "#0d0804",
  backgroundImage: [
    // Overhead pendant lamp bloom
    "radial-gradient(ellipse 70% 38% at 50% -2%, rgba(255,214,130,0.36) 0%, transparent 100%)",
    // Warm side fills
    "radial-gradient(circle at 8% 20%, rgba(90,50,14,0.18), transparent 30rem)",
    "radial-gradient(circle at 92% 15%, rgba(150,95,35,0.18), transparent 32rem)",
    // Vignette corners
    "radial-gradient(ellipse 120% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
    // Base horizontal gradient
    "linear-gradient(90deg, #090402 0%, #221208 18%, #3a1e0d 50%, #221208 82%, #090402 100%)",
  ].join(", "),
};

const woodGrainStyle = {
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(255,228,170,0.055) 0 1px, transparent 1px 52px)",
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 32px)",
  ].join(", "),
};

const bookcasePanelStyle = {
  backgroundColor: "#1e0e07",
  backgroundImage: [
    "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,210,130,0.12), transparent 60%)",
    "repeating-linear-gradient(90deg, rgba(255,230,180,0.06) 0 2px, rgba(70,35,14,0.08) 2px 20px, rgba(0,0,0,0.14) 20px 22px)",
    "linear-gradient(180deg, #2e1508 0%, #180b04 100%)",
  ].join(", "),
  boxShadow:
    "inset 0 40px 80px rgba(0,0,0,0.5), inset 0 -40px 80px rgba(0,0,0,0.4), 0 40px 100px rgba(0,0,0,0.5)",
};

const topRailStyle = {
  backgroundImage:
    "linear-gradient(180deg, rgba(255,232,170,0.38) 0%, rgba(180,110,40,0.65) 20%, rgba(80,38,12,0.92) 60%, rgba(22,10,3,0.99) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 36px)",
  boxShadow:
    "inset 0 3px 0 rgba(255,240,196,0.5), inset 0 -8px 18px rgba(0,0,0,0.5), 0 12px 28px rgba(0,0,0,0.42)",
};

const sidePostStyle = {
  backgroundImage:
    "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(40,18,6,0.9) 22%, rgba(90,48,18,0.85) 50%, rgba(40,18,6,0.9) 78%, rgba(0,0,0,0.7) 100%)",
  boxShadow:
    "inset 2px 0 8px rgba(255,224,160,0.12), inset -2px 0 8px rgba(255,224,160,0.08), 0 0 24px rgba(0,0,0,0.5)",
};

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------
const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isDeleting,
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen && !isDeleting) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, isDeleting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="min-h-screen px-4 flex justify-center items-center">
        <div
          onClick={!isDeleting ? onClose : undefined}
          className="bg-black/50 backdrop-blur-sm fixed inset-0 animate-in fade-in duration-200"
          aria-hidden="true"
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="max-w-md w-full bg-white rounded-xl p-5 md:p-6 shadow-xl relative animate-in zoom-in-95 duration-200"
        >
          <h3
            id="delete-modal-title"
            className="text-gray-900 text-base md:text-lg font-semibold mb-3 md:mb-4 pr-4 wrap-break-word"
          >
            {title}
          </h3>
          <p className="text-gray-600 text-sm md:text-base mb-5 md:mb-6">
            {message}
          </p>
          <div className="flex justify-end items-center gap-x-2 md:gap-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function DashboardPage() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateBookModalOpen, setIsCreateBookModalOpen] = useState(false);
  const [bookToDeleteId, setBookToDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookViewMode, setBookViewMode] = useState(() => {
    if (typeof window === "undefined") return "flat";
    return localStorage.getItem("bookify-dashboard-view") === "flat"
      ? "flat"
      : localStorage.getItem("bookify-dashboard-view") === "shelf"
        ? "shelf"
        : "flat";
  });

  const navigate = useNavigate();
  const isShelfView = bookViewMode === "shelf";

  useEffect(() => {
    const fetchBooks = async () => {
      setIsLoading(true);
      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.BOOKS.GET_ALL);
        setBooks(normalizeBooks(data?.books));
      } catch (error) {
        console.error("Error fetching user books:", error);
        toast.error("Failed to load your library!", { duration: 5000 });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBooks();
  }, []);

  useEffect(() => {
    localStorage.setItem("bookify-dashboard-view", bookViewMode);
  }, [bookViewMode]);

  const handleDeleteBook = async () => {
    if (!bookToDeleteId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(
        `${API_ENDPOINTS.BOOKS.DELETE}/${bookToDeleteId}`
      );
      setBooks((prev) => prev.filter((b) => b._id !== bookToDeleteId));
      toast.success("Book removed successfully!");
    } catch (error) {
      console.error("Error deleting book:", error);
      toast.error("Failed to remove book!");
    } finally {
      setIsDeleting(false);
      setBookToDeleteId(null);
    }
  };

  const handleCreateBook = (bookId) => {
    setIsCreateBookModalOpen(false);
    navigate(`/books/${bookId}/edit`);
  };

  const handleDeleteRequest = (bookId) => (event) => {
    event.stopPropagation();
    setBookToDeleteId(bookId);
  };

  // Chunk books into rows of BOOKS_PER_ROW for the multi-plank shelf
  const shelfRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < books.length; i += BOOKS_PER_ROW) {
      rows.push(books.slice(i, i + BOOKS_PER_ROW));
    }
    return rows;
  }, [books]);

  const skeletonRows = useMemo(() => {
    const dummy = Array(10).fill(null);
    const rows = [];
    for (let i = 0; i < dummy.length; i += BOOKS_PER_ROW) {
      rows.push(dummy.slice(i, i + BOOKS_PER_ROW));
    }
    return rows;
  }, []);

  const dashboardModals = (
    <>
      <DeleteConfirmationModal
        isOpen={Boolean(bookToDeleteId)}
        onClose={() => !isDeleting && setBookToDeleteId(null)}
        onConfirm={handleDeleteBook}
        isDeleting={isDeleting}
        title={`Remove "${
          books.find((b) => b?._id === bookToDeleteId)?.title || "this book"
        }"?`}
        message="This action is permanent and cannot be undone. All chapters and content will be lost."
      />
      <CreateBookModal
        isOpen={isCreateBookModalOpen}
        onClose={() => setIsCreateBookModalOpen(false)}
        onBookCreate={handleCreateBook}
      />
    </>
  );

  // -------------------------------------------------------------------------
  // Flat view
  // -------------------------------------------------------------------------
  if (!isShelfView) {
    return (
      <DashboardLayout>
        <main className="container max-w-7xl p-4 md:p-6 mx-auto">
          <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-gray-900 text-xl md:text-2xl font-bold mb-1">
                Library
              </h1>
              <p className="text-gray-600 text-xs md:text-sm">
                Manage your collection and bring stories to life
              </p>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <ViewModeToggle isShelfView={isShelfView} onChange={setBookViewMode} />
              <Button
                type="button"
                onClick={() => setIsCreateBookModalOpen(true)}
                icon={BookPlus}
                className="w-full sm:w-auto"
              >
                Create AI Book
              </Button>
            </div>
          </header>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array(4).fill(1).map((_, index) => (
                <BookCardSkeleton key={index} variant="flat" />
              ))}
            </div>
          ) : books.length === 0 ? (
            <section className="text-center border-2 border-dashed border-gray-200 rounded-xl py-12 md:py-16 mt-8 flex flex-col justify-center items-center">
              <div className="size-14 md:size-16 bg-gray-100 rounded-full mb-4 flex justify-center items-center">
                <Book className="size-7 md:size-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 text-base md:text-lg font-medium mb-2">
                Your library awaits
              </h3>
              <p className="max-w-md text-gray-500 text-sm md:text-base mb-6 px-4">
                Begin your creative journey and publish your first masterpiece.
              </p>
              <Button
                type="button"
                onClick={() => setIsCreateBookModalOpen(true)}
                icon={PencilLine}
              >
                Start Writing
              </Button>
            </section>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {books.map((book) => (
                <BookCard
                  key={book._id}
                  book={book}
                  variant="flat"
                  onDelete={handleDeleteRequest(book._id)}
                />
              ))}
            </ul>
          )}

          {dashboardModals}
        </main>
      </DashboardLayout>
    );
  }

  // -------------------------------------------------------------------------
  // 3D Shelf view
  // -------------------------------------------------------------------------
  return (
    <DashboardLayout>
      <main
        className="min-h-full relative overflow-hidden text-[#f8ead1]"
        style={roomBgStyle}
      >
        {/* Wood-grain wall texture overlay */}
        <div className="absolute inset-0 opacity-60 pointer-events-none" style={woodGrainStyle} />

        {/* Overhead pendant lamp bloom */}
        <div className="absolute inset-x-0 top-0 h-[28rem] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 55% 100% at 50% 0%, rgba(255,218,140,0.22) 0%, transparent 100%)",
          }}
        />

        {/* Edge vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 110% 85% at 50% 40%, transparent 45%, rgba(0,0,0,0.72) 100%)",
          }}
        />

        {/* Ambient dust particles */}
        <div className="absolute top-[18%] left-[14%] w-2 h-2 rounded-full bg-[#ffdb8c]/10 blur-sm pointer-events-none" />
        <div className="absolute top-[32%] right-[19%] w-1.5 h-1.5 rounded-full bg-[#ffdb8c]/8 blur-sm pointer-events-none" />
        <div className="absolute top-[55%] left-[38%] w-1 h-1 rounded-full bg-[#ffdb8c]/7 blur-[2px] pointer-events-none" />
        <div className="absolute top-[12%] right-[42%] w-2.5 h-2.5 rounded-full bg-[#ffdb8c]/6 blur-md pointer-events-none" />

        <div className="container max-w-7xl p-4 md:p-6 mx-auto relative">

          {/* ── Page header ─────────────────────────────────────────────── */}
          <header
            className="mb-7 md:mb-9 rounded-2xl px-5 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            style={{
              background: "linear-gradient(135deg, rgba(30,14,5,0.92) 0%, rgba(22,10,3,0.88) 100%)",
              border: "1px solid rgba(180,120,45,0.22)",
              boxShadow: "inset 0 1px 0 rgba(255,230,170,0.1), 0 20px 50px rgba(0,0,0,0.45)",
            }}
          >
            {/* Left — title block */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="size-10 md:size-11 rounded-xl flex items-center justify-center shrink-0 text-[#e8c87a]"
                style={{
                  background: "linear-gradient(145deg, rgba(40,20,6,0.9) 0%, rgba(22,10,3,0.95) 100%)",
                  border: "1px solid rgba(200,145,50,0.2)",
                  boxShadow: "inset 0 1px 0 rgba(255,225,150,0.1), 0 8px 20px rgba(0,0,0,0.4)",
                }}
              >
                <BookOpen className="size-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <h1 className="text-[#fff5e0] text-lg md:text-xl font-bold tracking-tight leading-none">
                    Your Bookshelf
                  </h1>
                  {/* Inline book count pill */}
                  <span
                    className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-wide"
                    style={{
                      background: "rgba(200,145,40,0.18)",
                      border: "1px solid rgba(200,145,40,0.3)",
                      color: "#e8b84a",
                    }}
                  >
                    {isLoading ? "—" : books.length} {books.length === 1 ? "book" : "books"}
                  </span>
                </div>
                <p className="text-[#9e8a68] text-xs md:text-[13px] leading-none">
                  Private Library
                </p>
              </div>
            </div>

            {/* Right — controls */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <ViewModeToggle isShelfView={isShelfView} onChange={setBookViewMode} theme="shelf" />
              <Button
                type="button"
                onClick={() => setIsCreateBookModalOpen(true)}
                icon={BookPlus}
                className="flex-1 sm:flex-none"
              >
                New Book
              </Button>
            </div>
          </header>

          {/* ── Bookcase ──────────────────────────────────────────────────── */}
          <div className="relative">
            {/* Top rail */}
            <div
              className="h-7 md:h-8 rounded-t-xl"
              style={topRailStyle}
            />

            {/* Main cabinet */}
            <div
              className="relative flex"
              style={bookcasePanelStyle}
            >
              {/* Left side post */}
              <div
                className="hidden md:block w-7 shrink-0 self-stretch rounded-bl-lg"
                style={sidePostStyle}
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#e8c880]/10" />
              </div>

              {/* Book content area */}
              <div className="flex-1 min-w-0 px-3 md:px-5 py-6 md:py-8">
                {/* Inner frame inset shadow */}
                <div className="absolute inset-0 rounded-b-xl pointer-events-none"
                  style={{
                    boxShadow: "inset 0 0 60px rgba(0,0,0,0.45), inset 0 0 120px rgba(0,0,0,0.22)",
                  }}
                />

                {isLoading ? (
                  <div className="space-y-0">
                    {skeletonRows.map((row, rowIdx) => (
                      <div key={rowIdx}>
                        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-8 sm:gap-x-10 md:gap-x-12 gap-y-4 items-end pb-2">
                          {row.map((_, i) => (
                            <BookCardSkeleton key={i} variant="shelf" />
                          ))}
                        </ul>
                        <ShelfPlank />
                        <div className="h-8 md:h-10" />
                      </div>
                    ))}
                  </div>
                ) : books.length === 0 ? (
                  /* Empty state — show two empty shelves with message */
                  <div>
                    {[0, 1].map((rowIdx) => (
                      <div key={rowIdx}>
                        {rowIdx === 0 && (
                          <section className="relative z-10 py-10 md:py-12 flex flex-col justify-center items-center text-center">
                            <div
                              className="size-20 rounded-2xl mb-5 flex justify-center items-center border border-[#c49b62]/26"
                              style={{
                                background: "linear-gradient(135deg, rgba(20,10,4,0.85) 0%, rgba(40,20,8,0.7) 100%)",
                                boxShadow: "inset 0 1px 0 rgba(255,237,202,0.16), 0 20px 42px rgba(0,0,0,0.38)",
                              }}
                            >
                              <Book className="size-10 text-[#e7c47e]" />
                            </div>
                            <h3 className="text-[#fff4dc] text-xl md:text-2xl font-black mb-2">
                              Your shelf is ready
                            </h3>
                            <p className="max-w-md text-[#c9b28a] text-sm md:text-base mb-6 px-4">
                              Generate your first AI book and it will appear here as a finished volume.
                            </p>
                            <Button
                              type="button"
                              onClick={() => setIsCreateBookModalOpen(true)}
                              icon={PencilLine}
                            >
                              Start Writing
                            </Button>
                          </section>
                        )}
                        <ShelfPlank />
                        <div className="h-8 md:h-10" />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Books — row by row, each with its own shelf plank */
                  <div>
                    {shelfRows.map((row, rowIdx) => (
                      <div key={rowIdx}>
                        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-8 sm:gap-x-10 md:gap-x-12 gap-y-4 items-end pb-2">
                          {row.map((book) => (
                            <BookCard
                              key={book._id}
                              book={book}
                              variant="shelf"
                              onDelete={handleDeleteRequest(book._id)}
                            />
                          ))}
                        </ul>
                        <ShelfPlank />
                        {rowIdx < shelfRows.length - 1 && (
                          <div className="h-8 md:h-10" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right side post */}
              <div
                className="hidden md:block w-7 shrink-0 self-stretch rounded-br-lg"
                style={sidePostStyle}
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#e8c880]/10" />
              </div>
            </div>

            {/* Bottom base bar */}
            <div
              className="h-5 md:h-6 rounded-b-xl"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(50,24,8,0.98) 0%, rgba(14,6,2,1) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px)",
                boxShadow: "0 12px 36px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5)",
              }}
            />

            {/* Floor shadow under bookcase */}
            <div
              className="h-6 mx-6 rounded-b-full blur-xl opacity-70"
              style={{ background: "rgba(0,0,0,0.55)" }}
            />
          </div>
        </div>

        {dashboardModals}
      </main>
    </DashboardLayout>
  );
}

export default DashboardPage;
