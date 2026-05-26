import { useNavigate } from "react-router";
import { resolveImageUrl } from "../utils/api-endpoints";
import { Edit, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Spine color palettes — deterministic based on book _id
// ---------------------------------------------------------------------------
const SPINE_PALETTES = [
  {
    bg: "linear-gradient(90deg, #0a1628 0%, #1a3a6e 38%, #2d5fa8 52%, #0e2045 100%)",
    accent: "#8bb8f0",
    shadow: "rgba(20,50,120,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #1a0a06 0%, #5c1a0e 38%, #9b3222 52%, #3a0e08 100%)",
    accent: "#f0a090",
    shadow: "rgba(100,30,18,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #061408 0%, #133d1a 38%, #1f6b2c 52%, #0a2210 100%)",
    accent: "#86d898",
    shadow: "rgba(15,70,28,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #0c0c0c 0%, #282828 38%, #424242 52%, #111 100%)",
    accent: "#d8d8d8",
    shadow: "rgba(20,20,20,0.6)",
  },
  {
    bg: "linear-gradient(90deg, #130a1f 0%, #3b1a5f 38%, #6b34a8 52%, #1e0c36 100%)",
    accent: "#c090f8",
    shadow: "rgba(60,20,100,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #1a1206 0%, #5c3e10 38%, #9b6b1a 52%, #3a2206 100%)",
    accent: "#f0cc7a",
    shadow: "rgba(100,70,14,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #0a1a1a 0%, #1a4d4d 38%, #2d8282 52%, #0e2a2a 100%)",
    accent: "#7ae0e0",
    shadow: "rgba(14,70,70,0.55)",
  },
  {
    bg: "linear-gradient(90deg, #1a0a12 0%, #5c1a36 38%, #9b3262 52%, #3a0e1e 100%)",
    accent: "#f090b8",
    shadow: "rgba(100,20,56,0.55)",
  },
];

const hashId = (id) =>
  id?.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) ?? 0;

const pageEdgeStyle = {
  backgroundImage:
    "repeating-linear-gradient(180deg, rgba(119,82,45,0.18) 0 1px, transparent 1px 5px), linear-gradient(90deg, #a87c48 0%, #fff5e0 32%, #e8cc9a 60%, #9a6030 100%)",
};

// ---------------------------------------------------------------------------
// BookCard
// ---------------------------------------------------------------------------
function BookCard({ book, onDelete, variant = "shelf" }) {
  const navigate = useNavigate();
  const { _id, title, subtitle, coverImage } = book;

  const coverImageUrl = coverImage
    ? resolveImageUrl(coverImage)
    : "/images/default-book-cover.jpg";

  const palette = SPINE_PALETTES[hashId(_id) % SPINE_PALETTES.length];

  const openBook = () => navigate(`/books/${_id}`);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openBook();
    }
  };

  // -------------------------------------------------------------------------
  // Flat variant
  // -------------------------------------------------------------------------
  if (variant === "flat") {
    return (
      <li
        onClick={openBook}
        aria-label={`Open ${title}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer relative group transition-all duration-300 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-100/50 hover:-translate-y-1 focus-within:border-gray-200 focus-within:shadow-xl focus-within:shadow-gray-100/50 focus-within:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      >
        <div className="bg-linear-to-br from-gray-50 to-gray-100 overflow-hidden relative">
          <img
            src={coverImageUrl}
            alt={`${title} cover`}
            onError={(e) => { e.target.src = "/images/default-book-cover.jpg"; }}
            className="w-full aspect-16/25 object-cover transition-transform duration-500 group-hover:scale-105 group-focus-within:scale-105"
          />
          <div className="opacity-0 flex items-center gap-2 absolute top-2 md:top-3 right-2 md:right-3 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/books/${_id}/edit`); }}
              aria-label="Edit book"
              title="Edit book"
              className="size-7 md:size-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg inline-flex justify-center items-center transition-all duration-200 hover:bg-white hover:scale-110 focus-visible:bg-white focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Edit className="size-3.5 md:size-4 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete book"
              title="Delete book"
              className="size-7 md:size-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg inline-flex justify-center items-center transition-all duration-200 hover:bg-red-50 hover:scale-110 focus-visible:bg-red-50 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group/delete"
            >
              <Trash2 className="size-3.5 md:size-4 text-red-500 group-hover/delete:text-red-600 group-focus-visible/delete:text-red-600" />
            </button>
          </div>
        </div>

        <section className="text-white p-4 md:p-5 absolute bottom-0 left-0 right-0">
          <div className="bg-linear-to-r from-black/80 to-transparent backdrop-blur-sm absolute inset-0" />
          <div className="relative">
            <h3 className="text-white font-semibold text-sm md:text-base leading-tight line-clamp-2 mb-0.5 md:mb-1">
              {title}
            </h3>
            <p className="text-gray-300 text-xs md:text-[13px] font-medium truncate">
              {subtitle || "No subtitle"}
            </p>
          </div>
        </section>

        <div className="h-[3px] bg-linear-to-r from-orange-500 via-amber-500 to-rose-500 opacity-0 absolute bottom-0 left-0 right-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
      </li>
    );
  }

  // -------------------------------------------------------------------------
  // Shelf / 3D variant
  // -------------------------------------------------------------------------
  return (
    <li
      onClick={openBook}
      aria-label={`Open ${title}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative cursor-pointer group [perspective:1100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c47e] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0804] rounded-xl"
    >
      {/* Drop shadow cast onto shelf */}
      <div
        className="absolute -bottom-1 left-[15%] right-[5%] h-4 blur-lg opacity-70 transition-all duration-500 group-hover:opacity-90 group-hover:blur-xl group-hover:-bottom-2"
        style={{ background: `radial-gradient(ellipse, ${palette.shadow} 0%, rgba(0,0,0,0.4) 100%)` }}
      />

      {/* 3D book body */}
      <div
        className="relative mx-auto w-full max-w-[9.5rem] sm:max-w-[10.5rem] md:max-w-[11.5rem] transform-gpu [transform-style:preserve-3d]"
        style={{
          transform: "rotateY(-10deg) rotateX(1deg)",
          transition: "transform 550ms cubic-bezier(0.34, 1.5, 0.64, 1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform =
            "translateY(-12px) rotateY(-20deg) rotateX(3deg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "rotateY(-10deg) rotateX(1deg)";
        }}
        onFocus={(e) => {
          e.currentTarget.style.transform =
            "translateY(-12px) rotateY(-20deg) rotateX(3deg)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.transform = "rotateY(-10deg) rotateX(1deg)";
        }}
      >
        {/* ── Page edge (right face) — visible linen strip ── */}
        <div
          className="absolute top-[3%] bottom-[3%] -right-[1.6rem] w-8 origin-left rounded-r-md [transform:rotateY(75deg)]"
          style={{
            ...pageEdgeStyle,
            boxShadow: "inset -6px 0 12px rgba(80,44,12,0.3), 6px 4px 14px rgba(0,0,0,0.35)",
          }}
        />

        {/* ── Spine (left face) ── */}
        <div
          className="absolute inset-y-0 -left-[1.4rem] w-9 rounded-l-md overflow-hidden"
          style={{
            backgroundImage: palette.bg,
            boxShadow: "inset 3px 0 6px rgba(255,210,140,0.1), inset -5px 0 10px rgba(0,0,0,0.6), -5px 6px 14px rgba(0,0,0,0.35)",
          }}
        >
          {/* Top embossed rule */}
          <div className="absolute left-1.5 right-1.5 h-px top-[18%] opacity-35" style={{ background: palette.accent }} />
          {/* Bottom embossed rule */}
          <div className="absolute left-1.5 right-1.5 h-px bottom-[18%] opacity-35" style={{ background: palette.accent }} />
          {/* Vertical title */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden py-10">
            <span
              className="text-[7.5px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-rl] rotate-180 leading-none opacity-70 overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ color: palette.accent, maxHeight: "64%" }}
            >
              {title}
            </span>
          </div>
          {/* Spine highlight sliver */}
          <div className="absolute inset-y-3 left-[3px] w-[1.5px] rounded-full opacity-20 bg-white" />
        </div>

        {/* ── Binding gutter soft highlight ── */}
        <div className="absolute inset-y-3 -left-px w-3 rounded-l bg-white/10 blur-[2px] pointer-events-none" />

        {/* ── Cover ── */}
        <article
          className="relative overflow-hidden rounded-r-lg rounded-l-[2px] bg-[#120a04]"
          style={{
            boxShadow: "0 16px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,232,190,0.15)",
          }}
        >
          {/* Left binding shadow on cover face */}
          <div className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 60%, transparent 100%)" }}
          />
          {/* Top-to-bottom gloss sheen */}
          <div className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.18) 0%, transparent 45%, rgba(0,0,0,0.3) 100%)" }}
          />
          {/* Top highlight */}
          <div className="absolute inset-x-0 top-0 h-12 z-10 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 100%)" }}
          />
          {/* Specular diagonal sliver */}
          <div
            className="absolute top-0 bottom-0 left-7 w-4 z-10 pointer-events-none opacity-50"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
              transform: "skewX(-5deg)",
            }}
          />
          {/* Inner border frame */}
          <div className="absolute inset-2 z-10 rounded border border-white/10 pointer-events-none" />

          {/* Cover image */}
          <img
            src={coverImageUrl}
            alt={`${title} cover`}
            onError={(e) => { e.target.src = "/images/default-book-cover.jpg"; }}
            className="w-full aspect-16/25 object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />

          {/* Edit / Delete buttons */}
          <div className="opacity-0 flex items-center gap-1.5 absolute top-2 right-2 z-20 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/books/${_id}/edit`); }}
              aria-label="Edit book"
              title="Edit book"
              className="size-7 bg-white/90 backdrop-blur-sm rounded-full shadow-md inline-flex justify-center items-center transition-all duration-200 hover:bg-white hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Edit className="size-3.5 text-slate-800" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete book"
              title="Delete book"
              className="size-7 bg-white/90 backdrop-blur-sm rounded-full shadow-md inline-flex justify-center items-center transition-all duration-200 hover:bg-red-50 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group/delete"
            >
              <Trash2 className="size-3.5 text-red-500 group-hover/delete:text-red-600" />
            </button>
          </div>

          {/* Title overlay */}
          <section className="text-white px-3 py-3 absolute bottom-0 left-0 right-0 z-20">
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)" }} />
            <div className="relative pl-1">
              <h3 className="text-white font-semibold text-xs leading-snug line-clamp-2 mb-0.5 drop-shadow">
                {title}
              </h3>
              <p className="text-stone-300/75 text-[10px] font-medium truncate">
                {subtitle || "No subtitle"}
              </p>
            </div>
          </section>
        </article>
      </div>
    </li>
  );
}

export default BookCard;
