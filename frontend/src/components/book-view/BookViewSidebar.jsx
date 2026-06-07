import { BookOpen, X } from "lucide-react";

function BookViewSidebar({
  isOpen,
  book,
  selectedChapterIndex,
  onSelectChapter,
  onClose,
}) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const completedCount = selectedChapterIndex;
  const progressPercent =
    chapters.length > 1
      ? Math.round((selectedChapterIndex / (chapters.length - 1)) * 100)
      : 100;

  return (
    <aside
      className={`
        h-full flex flex-col shrink-0 border-r overflow-hidden
        fixed lg:relative left-0 top-0 z-40
        transition-[width,transform] duration-300 ease-in-out
        ${isOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full lg:w-0 lg:translate-x-0"}
      `}
      style={{
        background: "var(--reader-bg-sidebar)",
        borderColor: "var(--reader-border)",
      }}
      aria-label="Table of contents"
      aria-hidden={!isOpen}
    >
      {/* Inner wrapper prevents content flash during close animation */}
      <div className="w-72 h-full flex flex-col overflow-hidden">
        {/* ── sidebar header ─────────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 pt-5 pb-4 border-b"
          style={{ borderColor: "var(--reader-border)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="shrink-0 size-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--reader-accent-soft)" }}
              >
                <BookOpen
                  className="size-4"
                  style={{ color: "var(--reader-accent)" }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--reader-accent)" }}
                >
                  Contents
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close table of contents"
              className="shrink-0 size-7 rounded-lg flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
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
              <X className="size-3.5" />
            </button>
          </div>

          {/* Book info */}
          <div>
            <h2
              className="text-sm font-bold leading-snug truncate mb-0.5"
              style={{ color: "var(--reader-text)" }}
              title={book?.title}
            >
              {book?.title}
            </h2>
            <p
              className="text-xs truncate"
              style={{ color: "var(--reader-text-muted)" }}
            >
              by {book?.author}
            </p>
          </div>

          {/* Reading progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs"
                style={{ color: "var(--reader-text-subtle)" }}
              >
                {completedCount === 0
                  ? "Not started"
                  : completedCount === chapters.length - 1
                  ? "Complete"
                  : `Chapter ${selectedChapterIndex + 1} of ${chapters.length}`}
              </span>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: "var(--reader-accent)" }}
              >
                {progressPercent}%
              </span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: "var(--reader-border)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(to right, var(--reader-accent), var(--reader-accent-border))`,
                }}
              />
            </div>
          </div>
        </div>

        {/* ── chapter list ───────────────────────────────────────────── */}
        <ul
          className="flex-1 overflow-y-auto reader-scroll-area py-2"
          role="list"
        >
          {chapters.map((chapter, index) => {
            const isActive = selectedChapterIndex === index;
            const isRead = index < selectedChapterIndex;

            return (
              <li key={index} role="listitem">
                <button
                  type="button"
                  onClick={() => onSelectChapter(index)}
                  aria-current={isActive ? "true" : undefined}
                  title={chapter.title}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2"
                  style={{
                    background: isActive
                      ? "var(--reader-chapter-active-bg)"
                      : "transparent",
                    borderLeft: isActive
                      ? "3px solid var(--reader-chapter-active-border)"
                      : "3px solid transparent",
                    "--tw-ring-color": "var(--reader-accent)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "var(--reader-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActive
                      ? "var(--reader-chapter-active-bg)"
                      : "transparent";
                  }}
                >
                  {/* Chapter number badge */}
                  <span
                    className="shrink-0 size-6 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums mt-0.5"
                    style={{
                      background: isActive
                        ? "var(--reader-accent)"
                        : isRead
                        ? "var(--reader-accent-soft)"
                        : "var(--reader-hover)",
                      color: isActive
                        ? "#fff"
                        : isRead
                        ? "var(--reader-accent)"
                        : "var(--reader-text-subtle)",
                    }}
                  >
                    {isRead && !isActive ? "✓" : index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-sm font-medium leading-snug truncate"
                      style={{
                        color: isActive
                          ? "var(--reader-accent)"
                          : "var(--reader-text)",
                      }}
                    >
                      {chapter.title}
                    </span>
                    <span
                      className="block text-xs mt-0.5"
                      style={{ color: "var(--reader-text-subtle)" }}
                    >
                      Chapter {index + 1}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export default BookViewSidebar;
