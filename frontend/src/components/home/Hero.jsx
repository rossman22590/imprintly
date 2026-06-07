import { useAuthContext } from "../../contexts/AuthContext";
import { ArrowRight, BookOpen, Sparkles, WandSparkles, Pen, Zap, Star } from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";

const stats = [
  { value: "50K+", label: "Books Created" },
  { value: "4.9", label: "Star Rating" },
  { value: "10min", label: "Avg. Creation" },
];

const pills = [
  { icon: Pen, label: "Write" },
  { icon: WandSparkles, label: "AI Assist" },
  { icon: BookOpen, label: "Publish" },
  { icon: Zap, label: "Export" },
  { icon: Sparkles, label: "Outline" },
  { icon: Star, label: "Review" },
];

const headline = ["Turn", "Ideas", "Into", "Published", "Books."];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 32, rotateX: 20 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const bookChapters = [
  "Chapter 1 — The Beginning",
  "Chapter 2 — Rising Action",
  "Chapter 3 — The Turning Point",
  "Chapter 4 — Falling Action",
  "Chapter 5 — Resolution",
];

function Hero() {
  const { isAuthenticated } = useAuthContext();

  return (
    <article className="relative min-h-screen bg-white overflow-hidden flex flex-col">
      {/* Dot-grid background */}
      <div className="absolute inset-0 bg-dot-grid opacity-50" />

      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(109,40,217,0.07),transparent)]" />

      <div className="relative flex-1 max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-16 lg:pt-32 lg:pb-24 w-full grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-12 lg:gap-16 items-center">

        {/* ── Left Column ── */}
        <div className="flex flex-col gap-8 max-w-2xl">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center gap-x-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-2 w-fit"
          >
            <span className="size-2 rounded-full bg-violet-600 animate-pulse" />
            <span className="text-violet-800 text-xs font-semibold tracking-wide uppercase">
              Smart Publishing Platform
            </span>
          </motion.div>

          {/* Headline — word-by-word stagger */}
          <motion.h1
            className="font-headline text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-extrabold text-zinc-950 leading-[1.02] tracking-tight perspective-1000"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {headline.map((word, i) => (
              <motion.span
                key={word}
                variants={wordVariants}
                className={`inline-block mr-[0.25em] ${
                  i === 3 || i === 4 ? "text-violet-700" : ""
                }`}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            custom={0.55}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-zinc-500 text-lg sm:text-xl leading-relaxed max-w-xl"
          >
            Write, design, and export professional books in minutes. Your
            personal publishing assistant that handles the heavy lifting.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            custom={0.7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row items-start gap-3"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="group bg-zinc-950 text-white font-semibold rounded-xl px-7 py-4 shadow-xl shadow-zinc-950/20 inline-flex items-center gap-x-2 transition-colors duration-200 hover:bg-zinc-800"
              >
                <span>{isAuthenticated ? "Go to Dashboard" : "Start Writing Free"}</span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a
                href="#features"
                className="group text-zinc-700 font-semibold rounded-xl px-7 py-4 border border-zinc-200 inline-flex items-center gap-x-2 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50"
              >
                <Sparkles className="size-4 text-violet-600" />
                <span>See Features</span>
              </a>
            </motion.div>
          </motion.div>

          {/* Social proof */}
          <motion.div
            custom={0.85}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-x-4"
          >
            <div className="flex -space-x-2">
              {["AS", "SL", "AW"].map((initials) => (
                <div
                  key={initials}
                  className="size-8 rounded-full bg-linear-to-br from-violet-400 to-purple-600 ring-2 ring-white inline-flex items-center justify-center text-white text-[10px] font-bold"
                >
                  {initials}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-x-1">
              {Array(5).fill(0).map((_, i) => (
                <Star key={i} className="size-3.5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <p className="text-zinc-500 text-sm">
              Loved by <span className="text-zinc-900 font-semibold">50,000+</span> writers
            </p>
          </motion.div>

          {/* Stats row */}
          <motion.div
            custom={1.0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-100 max-w-md"
          >
            {stats.map(({ value, label }) => (
              <div key={label} className="flex flex-col">
                <span className="font-headline text-2xl font-extrabold text-zinc-950">{value}</span>
                <span className="text-zinc-500 text-xs mt-0.5">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right Column: Book Mock ── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="animate-float">
            {/* Book outer frame */}
            <div className="relative w-80 xl:w-96">
              {/* Page stack shadow (back pages) */}
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-zinc-200" />
              <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl bg-zinc-100" />

              {/* Main book page */}
              <div className="relative bg-white rounded-2xl shadow-2xl shadow-zinc-950/15 border border-zinc-100 overflow-hidden">
                {/* Book header / spine color bar */}
                <div className="h-2 bg-linear-to-r from-violet-600 to-purple-700" />

                {/* Book content */}
                <div className="p-7">
                  {/* Title area */}
                  <div className="mb-6">
                    <div className="h-3 w-3/4 rounded-full bg-zinc-950 mb-2.5" />
                    <div className="h-2.5 w-1/2 rounded-full bg-zinc-300" />
                  </div>

                  {/* Decorative divider */}
                  <div className="h-px bg-linear-to-r from-violet-200 to-transparent mb-6" />

                  {/* Chapter list */}
                  <div className="space-y-3.5">
                    {bookChapters.map((chapter, i) => (
                      <div key={chapter} className="flex items-center gap-x-3 group">
                        <span className="shrink-0 size-6 rounded-lg bg-violet-50 border border-violet-100 inline-flex items-center justify-center text-[10px] font-bold text-violet-700 font-mono">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div
                            className="h-2 rounded-full bg-zinc-200 transition-colors"
                            style={{ width: `${75 - i * 8}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Writing progress bar */}
                  <div className="mt-7 pt-5 border-t border-zinc-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Progress</span>
                      <span className="text-[11px] font-bold text-violet-700 font-mono">68%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-linear-to-r from-violet-600 to-purple-600"
                        initial={{ width: "0%" }}
                        animate={{ width: "68%" }}
                        transition={{ duration: 1.2, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>

                  {/* AI badge */}
                  <div className="mt-4 inline-flex items-center gap-x-1.5 bg-violet-50 rounded-full px-3 py-1.5">
                    <WandSparkles className="size-3 text-violet-600" />
                    <span className="text-[11px] font-semibold text-violet-700">AI Writing Active</span>
                  </div>
                </div>
              </div>

              {/* Floating notification chip */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-4 -right-4 bg-zinc-950 text-white rounded-2xl px-4 py-2.5 shadow-xl shadow-zinc-950/30 flex items-center gap-x-2"
              >
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold">Chapter 3 generated</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Pill Ticker ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="relative w-full border-t border-zinc-100 bg-zinc-50/60 backdrop-blur-sm py-4 overflow-hidden"
      >
        {/* Left + right fade masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-linear-to-r from-zinc-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-zinc-50 to-transparent z-10 pointer-events-none" />

        <div className="flex animate-pill-scroll gap-x-3 w-max">
          {[...pills, ...pills, ...pills, ...pills].map(({ icon: Icon, label }, i) => (
            <div
              key={`${label}-${i}`}
              className="inline-flex items-center gap-x-2 bg-white border border-zinc-200 rounded-full px-5 py-2 text-sm font-medium text-zinc-700 shadow-sm shrink-0"
            >
              <Icon className="size-3.5 text-violet-600 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </article>
  );
}

export default Hero;
