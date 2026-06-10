import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  PanelLeftClose,
  Settings2,
  Store,
  Headphones,
  Languages,
  Sun,
  Moon,
  BookOpen,
  X,
  Clock,
} from "lucide-react";
import { ReaderMarkdownContent } from "../../utils/reader-diagrams";
import BookViewSidebar from "./BookViewSidebar";
import toast from "react-hot-toast";
import axiosInstance from "../../lib/axios";
import { API_ENDPOINTS } from "../../utils/api-endpoints";

// ── helpers ────────────────────────────────────────────────────────────────

const THEMES = ["paper", "night", "white"];
const THEME_LABELS = { paper: "Paper", night: "Night", white: "White" };
const THEME_ICONS = {
  paper: <BookOpen className="size-3.5" />,
  night: <Moon className="size-3.5" />,
  white: <Sun className="size-3.5" />,
};

const FONT_FAMILIES = ["serif", "sans"];
const FONT_FAMILY_LABELS = { serif: "Serif", sans: "Sans-serif" };

const READING_WIDTHS = ["narrow", "normal", "wide"];
const READING_WIDTH_LABELS = { narrow: "Narrow", normal: "Normal", wide: "Wide" };
const READING_WIDTH_CLASS = {
  narrow: "max-w-xl",
  normal: "max-w-2xl",
  wide: "max-w-4xl",
};

const FONT_FAMILY_STYLE = {
  serif: "Georgia, Cambria, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Arial, sans-serif",
};

const THEME_COLOR_MODE = {
  paper: "light",
  night: "dark",
  white: "light",
};

const estimateReadingTime = (text = "") => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
};

const getStoredPrefs = () => {
  try {
    const raw = localStorage.getItem("reader-prefs");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const storePrefs = (prefs) => {
  try {
    localStorage.setItem("reader-prefs", JSON.stringify(prefs));
  } catch {
    /* noop */
  }
};

// ── component ──────────────────────────────────────────────────────────────

function BookView({ book }) {
  const prefs = getStoredPrefs();

  const handleLanguageChange = async (e) => {
    const val = e.target.value;
    const toastId = toast.loading("Switching language...");
    try {
      if (val === "english") {
        const active = book.translations?.find(t => t.isActive);
        if (active) {
          await axiosInstance.patch(API_ENDPOINTS.TRANSLATION.TOGGLE_ACTIVE(book._id, active._id), {
            isActive: false
          });
        }
      } else {
        await axiosInstance.patch(API_ENDPOINTS.TRANSLATION.TOGGLE_ACTIVE(book._id, val), {
          isActive: true
        });
      }
      toast.dismiss(toastId);
      window.location.reload();
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error("Failed to change language.");
    }
  };

  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    prefs.isSidebarOpen ?? true
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(prefs.theme ?? "paper");
  const [fontSize, setFontSize] = useState(prefs.fontSize ?? 18);
  const [fontFamily, setFontFamily] = useState(prefs.fontFamily ?? "serif");
  const [readingWidth, setReadingWidth] = useState(
    prefs.readingWidth ?? "normal"
  );
  const [readingProgress, setReadingProgress] = useState(0);

  const scrollRef = useRef(null);
  const settingsPanelRef = useRef(null);

  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const selectedChapter = chapters[selectedChapterIndex] || chapters[0];

  // ── persist prefs ────────────────────────────────────────────────────────
  useEffect(() => {
    storePrefs({ isSidebarOpen, theme, fontSize, fontFamily, readingWidth });
  }, [isSidebarOpen, theme, fontSize, fontFamily, readingWidth]);

  // ── scroll reset on chapter change ──────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    }

    const frame = requestAnimationFrame(() => setReadingProgress(0));

    return () => cancelAnimationFrame(frame);
  }, [selectedChapterIndex]);

  // ── reading progress via scroll ──────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return setReadingProgress(100);
    setReadingProgress(Math.round((el.scrollTop / scrollable) * 100));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      )
        return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedChapterIndex((i) => Math.min(i + 1, chapters.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedChapterIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chapters.length]);

  // ── close settings when clicking outside ────────────────────────────────
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleOutside = (e) => {
      if (
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(e.target)
      ) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isSettingsOpen]);

  // ── select chapter ───────────────────────────────────────────────────────
  const handleSelectChapter = useCallback((index) => {
    setSelectedChapterIndex(index);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  // ── empty state ──────────────────────────────────────────────────────────
  if (chapters.length === 0) {
    return (
      <div
        data-reader-theme="paper"
        className="h-screen flex items-center justify-center"
        style={{ background: "var(--reader-bg)" }}
      >
        <p style={{ color: "var(--reader-text-muted)" }}>
          No chapters available.
        </p>
      </div>
    );
  }

  const readingTimeMinutes = estimateReadingTime(selectedChapter?.content);

  return (
    <div
      data-reader-theme={theme}
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: "var(--reader-bg)", color: "var(--reader-text)" }}
    >
      {/* ── reading progress bar ─────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] z-50 transition-[width] duration-150 ease-out pointer-events-none"
        style={{
          background: `linear-gradient(to right, var(--reader-accent), var(--reader-accent-border))`,
          width: `${readingProgress}%`,
        }}
      />

      {/* ── layout shell ─────────────────────────────────────────────────── */}
      <div className="flex h-full overflow-hidden">
        {/* ── sidebar ────────────────────────────────────────────────────── */}
        <BookViewSidebar
          isOpen={isSidebarOpen}
          book={book}
          selectedChapterIndex={selectedChapterIndex}
          onSelectChapter={handleSelectChapter}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* ── mobile backdrop ──────────────────────────────────────────── */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── main ─────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* ── header ─────────────────────────────────────────────────── */}
          <header
            className="shrink-0 flex items-center justify-between px-4 h-14 border-b"
            style={{
              background: "var(--reader-bg-header)",
              borderColor: "var(--reader-border)",
            }}
          >
            {/* Left cluster */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/dashboard"
                aria-label="Back to dashboard"
                className="shrink-0 flex items-center gap-1.5 text-sm rounded-lg px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  color: "var(--reader-text-muted)",
                  "--tw-ring-color": "var(--reader-accent)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--reader-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <ArrowLeft className="size-4 shrink-0" />
                <span className="hidden sm:inline font-medium">Library</span>
              </Link>

              <div
                className="w-px h-4 shrink-0"
                style={{ background: "var(--reader-border)" }}
              />

              <button
                type="button"
                onClick={() => setIsSidebarOpen((v) => !v)}
                aria-label={isSidebarOpen ? "Close chapters" : "Open chapters"}
                className="shrink-0 rounded-lg p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                style={{ "--tw-ring-color": "var(--reader-accent)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--reader-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {isSidebarOpen ? (
                  <PanelLeftClose
                    className="size-4"
                    style={{ color: "var(--reader-text-muted)" }}
                  />
                ) : (
                  <PanelLeftOpen
                    className="size-4"
                    style={{ color: "var(--reader-text-muted)" }}
                  />
                )}
              </button>

              {/* Chapter / book info */}
              <div className="min-w-0 hidden sm:block">
                <p
                  className="text-xs truncate font-medium"
                  style={{ color: "var(--reader-text-subtle)" }}
                >
                  {book.title}
                </p>
                <p
                  className="text-sm truncate font-semibold leading-tight"
                  style={{ color: "var(--reader-text)" }}
                >
                  {selectedChapter?.title || `Chapter ${selectedChapterIndex + 1}`}
                </p>
              </div>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Reading time */}
              <span
                className="hidden md:flex items-center gap-1.5 text-xs"
                style={{ color: "var(--reader-text-subtle)" }}
              >
                <Clock className="size-3.5" />
                {readingTimeMinutes} min read
              </span>

              <div
                className="hidden md:block w-px h-4"
                style={{ background: "var(--reader-border)" }}
              />

              {/* Chapter counter */}
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--reader-text-subtle)" }}
              >
                {selectedChapterIndex + 1} / {chapters.length}
              </span>

              <div
                className="w-px h-4"
                style={{ background: "var(--reader-border)" }}
              />

              {/* Settings toggle */}
              <div className="relative" ref={settingsPanelRef}>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((v) => !v)}
                  aria-label="Reading settings"
                  aria-expanded={isSettingsOpen}
                  className="rounded-lg p-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: isSettingsOpen
                      ? "var(--reader-active)"
                      : "transparent",
                    color: isSettingsOpen
                      ? "var(--reader-accent)"
                      : "var(--reader-text-muted)",
                    "--tw-ring-color": "var(--reader-accent)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSettingsOpen)
                      e.currentTarget.style.background = "var(--reader-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSettingsOpen)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Settings2 className="size-4" />
                </button>

                {/* ── settings panel ─────────────────────────────────── */}
                {isSettingsOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border z-50 overflow-hidden"
                    style={{
                      background: "var(--reader-bg-sidebar)",
                      borderColor: "var(--reader-border)",
                    }}
                  >
                    {/* Panel header */}
                    <div
                      className="flex items-center justify-between px-5 py-3.5 border-b"
                      style={{ borderColor: "var(--reader-border)" }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--reader-text)" }}
                      >
                        Reading Preferences
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        aria-label="Close settings"
                        className="rounded-md p-1 transition-colors"
                        style={{ color: "var(--reader-text-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--reader-hover)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Theme */}
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-wider mb-2.5"
                          style={{ color: "var(--reader-text-subtle)" }}
                        >
                          Theme
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {THEMES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTheme(t)}
                              aria-pressed={theme === t}
                              className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                background:
                                  theme === t
                                    ? "var(--reader-accent-soft)"
                                    : "var(--reader-hover)",
                                borderColor:
                                  theme === t
                                    ? "var(--reader-accent-border)"
                                    : "var(--reader-border)",
                                color:
                                  theme === t
                                    ? "var(--reader-accent)"
                                    : "var(--reader-text-muted)",
                                "--tw-ring-color": "var(--reader-accent)",
                              }}
                            >
                              {THEME_ICONS[t]}
                              {THEME_LABELS[t]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font family */}
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-wider mb-2.5"
                          style={{ color: "var(--reader-text-subtle)" }}
                        >
                          Typeface
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {FONT_FAMILIES.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setFontFamily(f)}
                              aria-pressed={fontFamily === f}
                              className="rounded-xl py-2.5 px-3 text-sm border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                fontFamily: FONT_FAMILY_STYLE[f],
                                background:
                                  fontFamily === f
                                    ? "var(--reader-accent-soft)"
                                    : "var(--reader-hover)",
                                borderColor:
                                  fontFamily === f
                                    ? "var(--reader-accent-border)"
                                    : "var(--reader-border)",
                                color:
                                  fontFamily === f
                                    ? "var(--reader-accent)"
                                    : "var(--reader-text-muted)",
                                "--tw-ring-color": "var(--reader-accent)",
                              }}
                            >
                              {FONT_FAMILY_LABELS[f]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size */}
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <label
                            className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--reader-text-subtle)" }}
                          >
                            Text Size
                          </label>
                          <span
                            className="text-xs tabular-nums font-medium"
                            style={{ color: "var(--reader-accent)" }}
                          >
                            {fontSize}px
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setFontSize((s) => Math.max(14, s - 2))
                            }
                            aria-label="Decrease font size"
                            className="shrink-0 size-8 rounded-lg border flex items-center justify-center text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              borderColor: "var(--reader-border)",
                              background: "var(--reader-hover)",
                              color: "var(--reader-text-muted)",
                              "--tw-ring-color": "var(--reader-accent)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--reader-active)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                "var(--reader-hover)")
                            }
                          >
                            A−
                          </button>
                          <input
                            type="range"
                            min={14}
                            max={28}
                            step={2}
                            value={fontSize}
                            onChange={(e) =>
                              setFontSize(Number(e.target.value))
                            }
                            aria-label="Font size slider"
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, var(--reader-accent) ${((fontSize - 14) / 14) * 100}%, var(--reader-border) 0%)`,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFontSize((s) => Math.min(28, s + 2))
                            }
                            aria-label="Increase font size"
                            className="shrink-0 size-8 rounded-lg border flex items-center justify-center text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                            style={{
                              borderColor: "var(--reader-border)",
                              background: "var(--reader-hover)",
                              color: "var(--reader-text-muted)",
                              "--tw-ring-color": "var(--reader-accent)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--reader-active)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                "var(--reader-hover)")
                            }
                          >
                            A+
                          </button>
                        </div>
                      </div>

                      {/* Reading width */}
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-wider mb-2.5"
                          style={{ color: "var(--reader-text-subtle)" }}
                        >
                          Line Width
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {READING_WIDTHS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setReadingWidth(w)}
                              aria-pressed={readingWidth === w}
                              className="rounded-xl py-2.5 text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
                              style={{
                                background:
                                  readingWidth === w
                                    ? "var(--reader-accent-soft)"
                                    : "var(--reader-hover)",
                                borderColor:
                                  readingWidth === w
                                    ? "var(--reader-accent-border)"
                                    : "var(--reader-border)",
                                color:
                                  readingWidth === w
                                    ? "var(--reader-accent)"
                                    : "var(--reader-text-muted)",
                                "--tw-ring-color": "var(--reader-accent)",
                              }}
                            >
                              {READING_WIDTH_LABELS[w]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Language selection dropdown */}
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-wider mb-2"
                          style={{ color: "var(--reader-text-subtle)" }}
                        >
                          Language
                        </label>
                        <select
                          value={book.translations?.find(t => t.isActive)?._id || "english"}
                          onChange={handleLanguageChange}
                          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{
                            background: "var(--reader-hover)",
                            borderColor: "var(--reader-border)",
                            color: "var(--reader-text)",
                            "--tw-ring-color": "var(--reader-accent)",
                          }}
                        >
                          <option value="english">English (Original)</option>
                          {(book.translations || []).map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.targetLanguage}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* KDP Studio link */}
                    <div
                      className="px-5 pb-5 pt-0"
                    >
                      <Link
                        to={`/books/${book._id}/kdp`}
                        className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          background: "var(--reader-accent)",
                          color: "#fff",
                          "--tw-ring-color": "var(--reader-accent)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.88")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onClick={() => setIsSettingsOpen(false)}
                      >
                        <Store className="size-4" />
                        Open KDP Studio
                      </Link>

                      <Link
                        to={`/books/${book._id}/audiobook`}
                        className="mt-2 flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          borderColor: "var(--reader-accent)",
                          color: "var(--reader-accent)",
                          "--tw-ring-color": "var(--reader-accent)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.78")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onClick={() => setIsSettingsOpen(false)}
                      >
                        <Headphones className="size-4" />
                        Open Audiobook
                      </Link>

                      <Link
                        to={`/books/${book._id}/translation`}
                        className="mt-2 flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          borderColor: "var(--reader-accent)",
                          color: "var(--reader-accent)",
                          "--tw-ring-color": "var(--reader-accent)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.78")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onClick={() => setIsSettingsOpen(false)}
                      >
                        <Languages className="size-4" />
                        Open Translations
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── reading area ───────────────────────────────────────────── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto reader-scroll-area"
            style={{ background: "var(--reader-bg)" }}
          >
            <article
              className={`${READING_WIDTH_CLASS[readingWidth]} mx-auto px-6 md:px-10 pt-12 pb-24`}
            >
              {/* Chapter heading */}
              <header className="mb-10">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
                  style={{ color: "var(--reader-accent)" }}
                >
                  Chapter {selectedChapterIndex + 1}
                </p>
                <h1
                  className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-2"
                  style={{
                    color: "var(--reader-text)",
                    fontFamily:
                      fontFamily === "serif"
                        ? "Georgia, Cambria, serif"
                        : "inherit",
                  }}
                >
                  {selectedChapter?.title}
                </h1>
                <div
                  className="flex items-center gap-4 mt-4 pt-4 border-t"
                  style={{ borderColor: "var(--reader-border)" }}
                >
                  <span
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--reader-text-subtle)" }}
                  >
                    <Clock className="size-3.5" />
                    {readingTimeMinutes} min read
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--reader-text-subtle)" }}
                  >
                    {selectedChapterIndex + 1} of {chapters.length} chapters
                  </span>
                </div>
              </header>

              {/* Markdown content */}
              <ReaderMarkdownContent
                source={selectedChapter?.content || ""}
                fontSize={fontSize}
                colorMode={THEME_COLOR_MODE[theme]}
                fontFamily={FONT_FAMILY_STYLE[fontFamily]}
              />

              {/* ── chapter navigation ───────────────────────────────── */}
              <nav
                className="mt-20 pt-8 border-t flex items-center gap-4"
                style={{ borderColor: "var(--reader-border)" }}
                aria-label="Chapter navigation"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedChapterIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={selectedChapterIndex === 0}
                  className="flex-1 group flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  style={{
                    borderColor: "var(--reader-border)",
                    background: "var(--reader-hover)",
                    color: "var(--reader-text)",
                    "--tw-ring-color": "var(--reader-accent)",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled)
                      e.currentTarget.style.background =
                        "var(--reader-active)";
                  }}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--reader-hover)")
                  }
                >
                  <ChevronLeft
                    className="size-5 shrink-0 transition-transform group-hover:-translate-x-0.5"
                    style={{ color: "var(--reader-text-muted)" }}
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-xs font-medium mb-0.5"
                      style={{ color: "var(--reader-text-subtle)" }}
                    >
                      Previous
                    </span>
                    <span
                      className="block text-sm font-semibold truncate"
                      style={{ color: "var(--reader-text)" }}
                    >
                      {selectedChapterIndex > 0
                        ? chapters[selectedChapterIndex - 1]?.title
                        : "Beginning"}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedChapterIndex((i) =>
                      Math.min(i + 1, chapters.length - 1)
                    )
                  }
                  disabled={selectedChapterIndex === chapters.length - 1}
                  className="flex-1 group flex items-center justify-end gap-3 rounded-2xl px-5 py-4 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed text-right"
                  style={{
                    borderColor: "var(--reader-border)",
                    background: "var(--reader-hover)",
                    color: "var(--reader-text)",
                    "--tw-ring-color": "var(--reader-accent)",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled)
                      e.currentTarget.style.background =
                        "var(--reader-active)";
                  }}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--reader-hover)")
                  }
                >
                  <span className="min-w-0">
                    <span
                      className="block text-xs font-medium mb-0.5"
                      style={{ color: "var(--reader-text-subtle)" }}
                    >
                      Next
                    </span>
                    <span
                      className="block text-sm font-semibold truncate"
                      style={{ color: "var(--reader-text)" }}
                    >
                      {selectedChapterIndex < chapters.length - 1
                        ? chapters[selectedChapterIndex + 1]?.title
                        : "The End"}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--reader-text-muted)" }}
                  />
                </button>
              </nav>
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}

export default BookView;
