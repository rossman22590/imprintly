import { Footer, Navbar } from "../components";
import { Link } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { motion } from "framer-motion";

const includedFeatures = [
  "Full Bookify writing workspace",
  "AI-assisted outlines, chapters, and revisions",
  "Book previews, exports, and reader-ready formatting",
  "KDP Studio tools for publish-ready production",
  "Public sharing for bookshelves and previews",
];

const proofPoints = [
  { icon: WandSparkles, label: "Create faster", text: "Turn rough ideas into structured books with guided AI workflows." },
  { icon: BadgeCheck, label: "Publish cleaner", text: "Move from draft to preview, export, and KDP prep in one place." },
  { icon: Star, label: "Keep ownership", text: "Build a reusable library of books, drafts, and shareable previews." },
];

const PRO_PLAN_CHECKOUT_URL = "https://buy.stripe.com/fZucMY8FS1Wz9Ki4MIgjC0x";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

function PricingPage() {
  return (
    <main className="bg-white text-zinc-950">
      <Navbar />

      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-dot-grid opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(109,40,217,0.08),transparent)]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-16 lg:pt-28 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              className="max-w-2xl"
            >
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-x-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-2 mb-7"
              >
                <span className="size-2 rounded-full bg-violet-600 animate-pulse" />
                <span className="text-violet-800 text-xs font-semibold tracking-wide uppercase">
                  Simple Pricing
                </span>
              </motion.div>

              <motion.h1
                custom={0.08}
                variants={fadeUp}
                className="font-headline text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-extrabold leading-[1.02] tracking-tight"
              >
                One plan for
                <br />
                <span className="text-violet-700">serious books.</span>
              </motion.h1>

              <motion.p
                custom={0.18}
                variants={fadeUp}
                className="text-zinc-500 text-lg sm:text-xl leading-relaxed mt-7 max-w-xl"
              >
                Bookify is $50 per month. If you have AI Tutor, Bookify is
                included for free.
              </motion.p>

              <motion.div
                custom={0.3}
                variants={fadeUp}
                className="flex flex-col sm:flex-row gap-3 mt-9"
              >
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <a
                    href={PRO_PLAN_CHECKOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-zinc-950 text-white font-semibold rounded-xl px-7 py-4 shadow-xl shadow-zinc-950/20 inline-flex items-center gap-x-2 transition-colors duration-200 hover:bg-zinc-800"
                  >
                    <span>Get Bookify Pro</span>
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                  </a>
                </motion.div>

                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/login"
                    className="group text-zinc-700 font-semibold rounded-xl px-7 py-4 border border-zinc-200 inline-flex items-center gap-x-2 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <Sparkles className="size-4 text-violet-600" />
                    <span>AI Tutor member sign in</span>
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-7 sm:p-8 shadow-2xl shadow-zinc-950/8">
                <div className="absolute inset-x-0 top-0 h-2 bg-linear-to-r from-violet-600 to-purple-700" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
                      Bookify
                    </p>
                    <h2 className="font-headline text-3xl font-extrabold mt-2">
                      Pro Access
                    </h2>
                  </div>
                  <span className="size-12 rounded-2xl bg-violet-50 border border-violet-100 inline-flex items-center justify-center">
                    <CircleDollarSign className="size-6 text-violet-700" />
                  </span>
                </div>

                <div className="mt-8 flex items-end gap-x-2">
                  <span className="font-headline text-6xl font-extrabold leading-none">
                    $50
                  </span>
                  <span className="text-zinc-500 font-semibold pb-2">/ month</span>
                </div>

                <p className="text-zinc-500 text-sm leading-relaxed mt-5">
                  For writers and publishers who want the complete Bookify
                  workflow without an AI Tutor membership.
                </p>

                <a
                  href={PRO_PLAN_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-7 w-full bg-zinc-950 text-white font-semibold rounded-xl px-5 py-3.5 inline-flex items-center justify-center gap-x-2 transition-colors duration-200 hover:bg-zinc-800"
                >
                  <span>Get Pro</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
              </section>

              <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-7 sm:p-8 text-white shadow-2xl shadow-pink-950/25">
                <div className="absolute inset-x-0 top-0 h-2 bg-linear-to-r from-pink-500 via-fuchsia-500 to-yellow-300" />
                <div className="absolute inset-0 bg-dot-grid opacity-[0.06]" />
                <div className="absolute -right-16 -top-16 size-44 rounded-full bg-pink-500/20 blur-3xl" />
                <div className="absolute -left-12 bottom-0 size-36 rounded-full bg-yellow-300/10 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-pink-300 text-sm font-semibold uppercase tracking-widest">
                        AI Tutor
                      </p>
                      <h2 className="font-headline text-3xl font-extrabold mt-2">
                        Included
                      </h2>
                    </div>
                    <span className="size-12 rounded-2xl bg-yellow-300/10 border border-yellow-300/25 inline-flex items-center justify-center shadow-lg shadow-pink-500/10">
                      <BadgeCheck className="size-6 text-yellow-300" />
                    </span>
                  </div>

                  <div className="mt-8 flex items-end gap-x-2">
                    <span className="font-headline text-6xl font-extrabold leading-none text-yellow-300">
                      Free
                    </span>
                    <span className="text-pink-200 font-semibold pb-2">with AI Tutor</span>
                  </div>

                  <p className="text-zinc-400 text-sm leading-relaxed mt-5">
                    Already have AI Tutor? Your Bookify access is covered, so
                    you can move straight into the writing workspace.
                  </p>
                </div>
              </section>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 lg:pb-28">
        <div className="max-w-7xl px-6 lg:px-8 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-10 items-start">
            <motion.section
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-zinc-200 bg-white p-7 sm:p-8"
            >
              <h2 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight">
                Everything in Bookify.
              </h2>
              <ul className="mt-7 space-y-4">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex gap-x-3 text-zinc-700">
                    <span className="mt-0.5 size-6 rounded-lg bg-violet-50 border border-violet-100 inline-flex items-center justify-center shrink-0">
                      <Check className="size-4 text-violet-700" />
                    </span>
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {proofPoints.map(({ icon: Icon, label, text }, index) => (
                <motion.section
                  key={label}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-3xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-950/5 transition-all duration-300"
                >
                  <span className="size-12 rounded-2xl bg-linear-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-500/20 inline-flex items-center justify-center">
                    <Icon className="size-6 text-white" />
                  </span>
                  <h3 className="font-headline text-xl font-extrabold mt-5">
                    {label}
                  </h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mt-2">
                    {text}
                  </p>
                </motion.section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.04]" />
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-violet-600/60 to-transparent" />

        <div className="relative max-w-5xl px-6 lg:px-8 mx-auto py-20 lg:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="inline-flex items-center gap-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-zinc-400 text-xs font-semibold tracking-widest uppercase">
              Pick your path
            </p>
            <h2 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.04] tracking-tight mt-7">
              Pay monthly, or use the access you already have.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto mt-6">
              Either way, the product experience is the same: one complete
              Bookify workspace for writing, shaping, and preparing books.
            </p>
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block mt-9"
            >
              <a
                href={PRO_PLAN_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white text-zinc-950 font-bold rounded-xl px-8 py-4 shadow-2xl shadow-white/10 inline-flex items-center gap-x-2 transition-colors duration-200 hover:bg-zinc-100"
              >
                <span>Get Bookify Pro</span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

export default PricingPage;
