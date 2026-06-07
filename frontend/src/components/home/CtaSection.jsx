import { useAuthContext } from "../../contexts/AuthContext";
import { Link } from "react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function CtaSection() {
  const { isAuthenticated } = useAuthContext();

  return (
    <section className="bg-zinc-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-dot-grid opacity-[0.04] pointer-events-none" />
      <div className="absolute bottom-0 right-0 size-[500px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 size-72 bg-purple-900/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top border accent */}
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-violet-600/60 to-transparent" />

      <div className="max-w-5xl px-6 lg:px-8 mx-auto py-24 lg:py-36 text-center relative">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col items-center gap-8"
        >
          {/* Icon badge */}
          <motion.div variants={item}>
            <div className="size-16 rounded-2xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
              <BookOpen className="size-7 text-violet-400" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h2
            variants={item}
            className="font-headline text-5xl sm:text-6xl lg:text-7xl xl:text-[5rem] font-extrabold text-white leading-[1.02] tracking-tight max-w-4xl"
          >
            Your story
            <br />
            <span className="text-violet-400">deserves</span> to be read.
          </motion.h2>

          {/* Subtext */}
          <motion.p variants={item} className="text-zinc-400 text-lg sm:text-xl leading-relaxed max-w-xl">
            Join thousands of writers who transformed their ideas into
            beautifully published books — in minutes, not months.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to={isAuthenticated ? "/dashboard" : "/register"}
                className="group bg-white text-zinc-950 font-bold rounded-xl px-8 py-4 shadow-2xl shadow-white/10 inline-flex items-center gap-x-2 transition-colors duration-200 hover:bg-zinc-100"
              >
                <span>{isAuthenticated ? "Open Dashboard" : "Start for Free"}</span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {!isAuthenticated && (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/login"
                  className="text-zinc-400 font-semibold px-8 py-4 rounded-xl border border-white/10 inline-flex items-center gap-x-2 transition-all duration-200 hover:border-white/20 hover:text-zinc-200"
                >
                  Sign in
                </Link>
              </motion.div>
            )}
          </motion.div>

          {/* Trust note */}
          <motion.p variants={item} className="text-zinc-600 text-sm">
            No credit card required &bull; Free to start &bull; Export anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

export default CtaSection;
