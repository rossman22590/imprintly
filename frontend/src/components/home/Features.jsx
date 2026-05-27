import { useRef } from "react";
import { useAuthContext } from "../../contexts/AuthContext";
import { FEATURES } from "../../utils/constants";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";

const SPRING_CONFIG = { stiffness: 200, damping: 20 };

function TiltCard({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [6, -6]), SPRING_CONFIG);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-6, 6]), SPRING_CONFIG);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Features() {
  const { isAuthenticated } = useAuthContext();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const [aiFeature, previewFeature, exportFeature, dashboardFeature] = FEATURES;

  return (
    <article
      id="features"
      className="bg-white py-20 sm:py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-7xl px-6 lg:px-8 mx-auto">

        {/* Section header */}
        <motion.header
          ref={sectionRef}
          className="mb-14 lg:mb-20 max-w-2xl"
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-x-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-2 mb-5">
            <span className="size-2 rounded-full bg-violet-600 animate-pulse" />
            <span className="text-violet-800 text-xs font-semibold tracking-wide uppercase">
              Features
            </span>
          </div>

          <h2 className="font-headline text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-zinc-950 leading-[1.05] tracking-tight">
            Your Complete
            <br />
            <span className="text-violet-700">Author Toolkit.</span>
          </h2>

          <p className="text-zinc-500 text-base sm:text-lg leading-relaxed mt-5">
            From blank page to bestseller — everything you need is built right
            in, ready when inspiration strikes.
          </p>
        </motion.header>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 perspective-1000">

          {/* ── Large dark hero card (AI Writing) — spans 2 cols on lg ── */}
          <TiltCard
            delay={0}
            className="lg:col-span-2 bg-zinc-950 rounded-3xl p-8 sm:p-10 relative overflow-hidden cursor-default group"
          >
            {/* Shimmer border */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[conic-gradient(from_0deg,transparent_0%,rgba(109,40,217,0.4)_30%,transparent_60%)] blur-sm" />
            </div>

            {/* Decorative glow */}
            <div className="absolute -top-20 -right-20 size-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-48 rounded-full bg-purple-800/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full gap-6">
              <motion.div
                whileHover={{ scale: 1.12, rotate: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="size-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0"
              >
                {(() => {
                  const Icon = aiFeature.icon;
                  return <Icon className="size-7 text-violet-300" />;
                })()}
              </motion.div>

              <div className="flex-1">
                <h3 className="font-headline text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-3">
                  {aiFeature.title}
                </h3>
                <p className="text-zinc-400 text-base leading-relaxed max-w-md">
                  {aiFeature.description}
                </p>
              </div>

              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="group/link inline-flex items-center gap-x-2 text-violet-400 font-semibold text-sm hover:text-violet-300 transition-colors w-fit"
                aria-label="Try AI Writing Assistant"
              >
                <span>Try it now</span>
                <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-1" />
              </Link>
            </div>

            {/* Decorative code-like lines */}
            <div className="absolute right-8 bottom-8 opacity-10 font-mono text-[11px] text-white leading-relaxed select-none hidden sm:block">
              <div>generate_chapter(3)</div>
              <div>→ "The storm arrived at dawn..."</div>
            </div>
          </TiltCard>

          {/* ── Live Reader Preview ── */}
          <TiltCard
            delay={0.1}
            className="bg-white border border-zinc-200 rounded-3xl p-7 sm:p-8 relative overflow-hidden cursor-default group hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-950/5 transition-shadow duration-300"
          >
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-blue-50/0 to-cyan-50/0 group-hover:from-blue-50/60 group-hover:to-cyan-50/40 transition-all duration-400 pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-5 h-full">
              <motion.div
                whileHover={{ scale: 1.12, rotate: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`size-12 rounded-2xl bg-linear-to-br ${previewFeature.bgGradientColors} shadow-lg ${previewFeature.shadowColor} flex items-center justify-center shrink-0`}
              >
                {(() => {
                  const Icon = previewFeature.icon;
                  return <Icon className="size-6 text-white" />;
                })()}
              </motion.div>
              <div className="flex-1">
                <h3 className="font-headline text-xl font-extrabold text-zinc-950 mb-2 group-hover:text-blue-900 transition-colors">{previewFeature.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{previewFeature.description}</p>
              </div>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="group/link inline-flex items-center gap-x-1 text-zinc-400 hover:text-blue-600 text-sm font-medium transition-colors w-fit opacity-0 group-hover:opacity-100"
                aria-label={`Learn more about ${previewFeature.title}`}
              >
                <span>Learn more</span>
                <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-1" />
              </Link>
            </div>
          </TiltCard>

          {/* ── Instant Export ── */}
          <TiltCard
            delay={0.2}
            className="bg-white border border-zinc-200 rounded-3xl p-7 sm:p-8 relative overflow-hidden cursor-default group hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-950/5 transition-shadow duration-300"
          >
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-emerald-50/0 to-teal-50/0 group-hover:from-emerald-50/60 group-hover:to-teal-50/40 transition-all duration-400 pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-5 h-full">
              <motion.div
                whileHover={{ scale: 1.12, rotate: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`size-12 rounded-2xl bg-linear-to-br ${exportFeature.bgGradientColors} shadow-lg ${exportFeature.shadowColor} flex items-center justify-center shrink-0`}
              >
                {(() => {
                  const Icon = exportFeature.icon;
                  return <Icon className="size-6 text-white" />;
                })()}
              </motion.div>
              <div className="flex-1">
                <h3 className="font-headline text-xl font-extrabold text-zinc-950 mb-2 group-hover:text-emerald-900 transition-colors">{exportFeature.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{exportFeature.description}</p>
              </div>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="group/link inline-flex items-center gap-x-1 text-zinc-400 hover:text-emerald-600 text-sm font-medium transition-colors w-fit opacity-0 group-hover:opacity-100"
                aria-label={`Learn more about ${exportFeature.title}`}
              >
                <span>Learn more</span>
                <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-1" />
              </Link>
            </div>
          </TiltCard>

          {/* ── Project Dashboard ── */}
          <TiltCard
            delay={0.3}
            className="bg-white border border-zinc-200 rounded-3xl p-7 sm:p-8 relative overflow-hidden cursor-default group hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-950/5 transition-shadow duration-300"
          >
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-pink-50/0 to-rose-50/0 group-hover:from-pink-50/60 group-hover:to-rose-50/40 transition-all duration-400 pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-5 h-full">
              <motion.div
                whileHover={{ scale: 1.12, rotate: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`size-12 rounded-2xl bg-linear-to-br ${dashboardFeature.bgGradientColors} shadow-lg ${dashboardFeature.shadowColor} flex items-center justify-center shrink-0`}
              >
                {(() => {
                  const Icon = dashboardFeature.icon;
                  return <Icon className="size-6 text-white" />;
                })()}
              </motion.div>
              <div className="flex-1">
                <h3 className="font-headline text-xl font-extrabold text-zinc-950 mb-2 group-hover:text-pink-900 transition-colors">{dashboardFeature.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{dashboardFeature.description}</p>
              </div>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="group/link inline-flex items-center gap-x-1 text-zinc-400 hover:text-pink-600 text-sm font-medium transition-colors w-fit opacity-0 group-hover:opacity-100"
                aria-label={`Learn more about ${dashboardFeature.title}`}
              >
                <span>Learn more</span>
                <ArrowRight className="size-4 transition-transform group-hover/link:translate-x-1" />
              </Link>
            </div>
          </TiltCard>

        </div>

        {/* CTA */}
        <motion.footer
          className="text-center mt-14 lg:mt-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-zinc-500 text-base mb-5">
            Ready to bring your book to life?
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
            <Link
              to={isAuthenticated ? "/dashboard" : "/login"}
              className="group bg-zinc-950 text-white font-semibold rounded-xl px-8 py-4 shadow-xl shadow-zinc-950/20 inline-flex items-center gap-x-2 transition-colors duration-200 hover:bg-zinc-800"
            >
              <span>{isAuthenticated ? "My Writing Space" : "Launch Your First Book"}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.footer>

      </div>
    </article>
  );
}

export default Features;
